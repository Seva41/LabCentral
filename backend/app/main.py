from __future__ import annotations

import asyncio
import csv
import hashlib
import hmac
import io
import json
import logging
import os
import random
import re
import smtplib
import uuid
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime, timedelta
from email.utils import parseaddr
from pathlib import Path
from typing import Annotated
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile

from app.database import SessionLocal, engine, get_db
from app.mailer import is_configured as mailer_configured, send_password_reset
from app.models import (
    Base, Challenge, ChallengeAsset, EventCheckpoint, EventParticipant, GameEvent,
    IntegritySignal, LoginSession, PasswordResetToken, SubmissionAttempt, Solve, Team, User,
)
from app.realtime import event_stream
from app.rate_limits import rate_limiter
from app.scoring import ScorePolicy, points_for
from app.security import (
    USERNAME_RE, csrf_token, digest_session, flag_digest, hash_password,
    new_session_token, random_code, verify_flag, verify_password,
)


APP_DIR = Path(__file__).resolve().parent
SESSION_HOURS = 12
SUBMISSION_LIMIT = 20
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_REQUEST_UPLOAD_BYTES = 6 * 1024 * 1024
UPLOAD_EXTENSIONS = {".txt", ".md", ".pdf", ".png", ".jpg", ".jpeg", ".zip", ".pcap", ".pcapng", ".csv", ".json", ".bin"}
ASSET_DIR = Path(os.getenv("UPLOAD_DIR", str(APP_DIR / "data" / "assets")))
logger = logging.getLogger(__name__)
DUMMY_PASSWORD_HASH = hash_password(os.urandom(32).hex())


def clean_expired_records() -> None:
    try:
        retention_days = max(30, int(os.getenv("ATTEMPT_RETENTION_DAYS", "90")))
    except ValueError:
        retention_days = 90
    with SessionLocal() as db:
        db.execute(delete(LoginSession).where(LoginSession.expires_at <= utc_now()))
        db.execute(delete(PasswordResetToken).where((PasswordResetToken.expires_at <= utc_now()) | (PasswordResetToken.used_at.is_not(None))))
        db.execute(delete(SubmissionAttempt).where(SubmissionAttempt.attempted_at < utc_now() - timedelta(days=retention_days)))
        db.execute(delete(IntegritySignal).where(IntegritySignal.created_at < utc_now() - timedelta(days=retention_days)))
        referenced_assets = {f"{event_id}/{storage_key}" for event_id, storage_key in db.execute(select(ChallengeAsset.event_id, ChallengeAsset.storage_key)).all()}
        db.commit()
    if ASSET_DIR.is_dir():
        now = datetime.now().timestamp()
        for event_dir in ASSET_DIR.iterdir():
            if not event_dir.is_dir() or not event_dir.name.isdigit():
                continue
            for item in event_dir.iterdir():
                try:
                    age = now - item.stat().st_mtime
                    relative = f"{event_dir.name}/{item.name}"
                    if item.is_file() and item.name.endswith(".partial") and age > 7200:
                        item.unlink(missing_ok=True)
                    elif item.is_file() and item.name.endswith(".blob") and relative not in referenced_assets and age > 86400:
                        item.unlink(missing_ok=True)
                except OSError as error:
                    logger.warning("No se pudo limpiar almacenamiento de un adjunto (%s)", type(error).__name__)


async def maintenance_loop() -> None:
    while True:
        await asyncio.sleep(random.uniform(1800, 3600))
        try:
            await run_in_threadpool(clean_expired_records)
        except SQLAlchemyError as error:
            logger.warning("No se pudo completar la limpieza periódica (%s)", type(error).__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if os.getenv("APP_ENV", "development") == "production":
        flag_pepper = os.getenv("FLAG_PEPPER", "")
        setup_key = os.getenv("SETUP_KEY", "")
        if len(flag_pepper) < 32 or len(setup_key) < 24 or "replace-with" in flag_pepper or "replace-with" in setup_key:
            raise RuntimeError("En producción configura FLAG_PEPPER (32+ caracteres) y SETUP_KEY (24+ caracteres)")
    if os.getenv("APP_ENV", "development") != "production":
        Base.metadata.create_all(bind=engine)
    await event_stream.start()
    maintenance_task = asyncio.create_task(maintenance_loop(), name="labcentral-maintenance")
    try:
        yield
    finally:
        maintenance_task.cancel()
        with suppress(asyncio.CancelledError):
            await maintenance_task
        await event_stream.stop()
        await run_in_threadpool(rate_limiter.close)
        await run_in_threadpool(engine.dispose)


class RequestBodyLimitMiddleware:
    """Bound memory use for streamed/chunked HTTP request bodies."""

    def __init__(self, app, max_bytes: int = 262_144) -> None:
        self.app = app
        self.max_bytes = max_bytes
        self.upload_slots = asyncio.Semaphore(max(1, int(os.getenv("MAX_CONCURRENT_UPLOADS", "4"))))

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http" or scope.get("method") in {"GET", "HEAD", "OPTIONS"}:
            await self.app(scope, receive, send)
            return
        # Uploads are capped at the reverse proxy and streamed by Starlette's
        # multipart parser; buffer the small JSON endpoints only.
        if scope.get("method") == "POST" and re.fullmatch(r"/api/events/\d+/challenges/\d+/assets", scope.get("path", "")):
            raw_length = dict(scope.get("headers", [])).get(b"content-length")
            if raw_length:
                try:
                    if int(raw_length) > MAX_REQUEST_UPLOAD_BYTES:
                        await self._too_large(send)
                        return
                except ValueError:
                    await self._too_large(send)
                    return
            async with self.upload_slots:
                await self.app(scope, receive, send)
            return
        headers = dict(scope.get("headers", []))
        raw_length = headers.get(b"content-length")
        if raw_length:
            try:
                if int(raw_length) > self.max_bytes:
                    await self._too_large(send)
                    return
            except ValueError:
                await self._too_large(send)
                return

        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > self.max_bytes:
                await self._too_large(send)
                return
            body.extend(chunk)
            if not message.get("more_body", False):
                break

        request_body = bytes(body)
        delivered = False

        async def replay_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": request_body, "more_body": False}
            return await receive()

        await self.app(scope, replay_receive, send)

    async def _too_large(self, send) -> None:
        payload = '{"detail":"La solicitud supera el límite de tamaño permitido"}'.encode("utf-8")
        await send({
            "type": "http.response.start",
            "status": 413,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(payload)).encode()), (b"connection", b"close")],
        })
        await send({"type": "http.response.body", "body": payload})


app = FastAPI(title="LabCentral 2", version="1.0.0", lifespan=lifespan)
app.add_middleware(RequestBodyLimitMiddleware, max_bytes=262_144)
app.mount("/static", StaticFiles(directory=APP_DIR / "static"), name="static")


@app.exception_handler(SQLAlchemyError)
def database_error_handler(_request: Request, exc: SQLAlchemyError):
    logger.error("Error de base de datos (%s)", type(exc).__name__)
    return JSONResponse(status_code=503, content={"detail": "El servicio de datos no está disponible temporalmente"}, headers={"Retry-After": "3"})


class AccountInput(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    display_name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=12, max_length=200)

    @field_validator("display_name")
    @classmethod
    def nonblank_display_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("El nombre visible no puede estar vacío")
        return value.strip()

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        _name, address = parseaddr(normalized)
        if address != normalized or not re.fullmatch(r"[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+", normalized):
            raise ValueError("Ingresa un correo válido")
        return normalized


class SetupInput(AccountInput):
    setup_key: str = Field(min_length=24, max_length=200)


class RegisterInput(AccountInput):
    event_code: str = Field(min_length=5, max_length=12)


class LoginInput(BaseModel):
    username: str = Field(min_length=1, max_length=40)
    password: str = Field(min_length=1, max_length=200)


class ForgotPasswordInput(BaseModel):
    email: str = Field(min_length=5, max_length=254)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class ResetPasswordInput(BaseModel):
    token: str = Field(min_length=32, max_length=128)
    password: str = Field(min_length=12, max_length=200)


class EmailUpdateInput(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    current_password: str = Field(min_length=1, max_length=200)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        _name, address = parseaddr(normalized)
        if address != normalized or not re.fullmatch(r"[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+", normalized):
            raise ValueError("Ingresa un correo válido")
        return normalized


class EventCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=2000)
    mode: str = "solo"
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @field_validator("mode")
    @classmethod
    def valid_mode(cls, value: str) -> str:
        if value not in {"solo", "teams"}:
            raise ValueError("El modo debe ser solo o teams")
        return value

    @field_validator("title")
    @classmethod
    def nonblank_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("El título no puede estar vacío")
        return value.strip()


class EventPatch(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @field_validator("title")
    @classmethod
    def nonblank_title(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("El título no puede estar vacío")
        return value.strip() if value is not None else None


class EventStatusInput(BaseModel):
    status: str


class JoinEventInput(BaseModel):
    code: str = Field(min_length=5, max_length=12)


class TeamCreate(BaseModel):
    name: str = Field(min_length=2, max_length=60)

    @field_validator("name")
    @classmethod
    def nonblank_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("El nombre del equipo no puede estar vacío")
        return value.strip()


class TeamJoin(BaseModel):
    code: str = Field(min_length=5, max_length=12)


class ChallengeCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    category: str = Field(default="General", min_length=1, max_length=40)
    description: str = Field(min_length=1, max_length=5000)
    flag: str = Field(min_length=1, max_length=200)
    scoring_mode: str = "fixed"
    points: int = Field(default=100, ge=1, le=100_000)
    minimum_points: int = Field(default=50, ge=1, le=100_000)
    decay_per_solve: int = Field(default=10, ge=0, le=100_000)

    @field_validator("scoring_mode")
    @classmethod
    def valid_scoring_mode(cls, value: str) -> str:
        if value not in {"fixed", "dynamic"}:
            raise ValueError("El puntaje debe ser fixed o dynamic")
        return value

    @field_validator("title", "category", "description", "flag")
    @classmethod
    def nonblank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("El campo no puede estar vacío")
        return value.strip()


class ChallengePatch(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=120)
    category: str | None = Field(default=None, min_length=1, max_length=40)
    description: str | None = Field(default=None, min_length=1, max_length=5000)
    flag: str | None = Field(default=None, min_length=1, max_length=200)
    scoring_mode: str | None = None
    points: int | None = Field(default=None, ge=1, le=100_000)
    minimum_points: int | None = Field(default=None, ge=1, le=100_000)
    decay_per_solve: int | None = Field(default=None, ge=0, le=100_000)

    @field_validator("scoring_mode")
    @classmethod
    def valid_scoring_mode(cls, value: str | None) -> str | None:
        if value is not None and value not in {"fixed", "dynamic"}:
            raise ValueError("El puntaje debe ser fixed o dynamic")
        return value

    @field_validator("title", "category", "description", "flag")
    @classmethod
    def nonblank_optional_text(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("El campo no puede estar vacío")
        return value.strip() if value is not None else None


class SubmitInput(BaseModel):
    challenge_id: int
    flag: str = Field(min_length=1, max_length=200)

    @field_validator("flag")
    @classmethod
    def nonblank_flag(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("La flag no puede estar vacía")
        return value.strip()


def utc_now() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def normalized_username(value: str) -> str:
    value = value.strip()
    if not USERNAME_RE.fullmatch(value):
        raise HTTPException(422, "El usuario debe tener 3–40 caracteres: letras, números, punto, guion o guion bajo")
    return value.lower()


def create_login_session(response: Response, db: Session, user: User) -> None:
    token, csrf = new_session_token(), csrf_token()
    expires = utc_now() + timedelta(hours=SESSION_HOURS)
    db.add(LoginSession(token_digest=digest_session(token), csrf_token=csrf, user_id=user.id, expires_at=expires))
    db.commit()
    secure = os.getenv("COOKIE_SECURE", "0").lower() in {"1", "true", "yes"}
    response.set_cookie("labcentral_session", token, httponly=True, secure=secure, samesite="strict", max_age=SESSION_HOURS * 3600, path="/")
    response.set_cookie("labcentral_csrf", csrf, httponly=False, secure=secure, samesite="strict", max_age=SESSION_HOURS * 3600, path="/")


def session_for_request(request: Request, db: Session) -> tuple[User, LoginSession] | None:
    token = request.cookies.get("labcentral_session")
    if not token:
        return None
    session = db.scalar(select(LoginSession).where(LoginSession.token_digest == digest_session(token)))
    if not session:
        return None
    expires = as_utc(session.expires_at)
    if not expires or expires <= utc_now():
        db.delete(session)
        db.commit()
        return None
    user = db.get(User, session.user_id)
    return (user, session) if user else None


def require_user(request: Request, db: Annotated[Session, Depends(get_db)]) -> User:
    pair = session_for_request(request, db)
    if not pair:
        raise HTTPException(401, "Inicia sesión para continuar")
    return pair[0]


def require_admin(user: Annotated[User, Depends(require_user)]) -> User:
    if not user.is_admin:
        raise HTTPException(403, "Se requiere una cuenta de organización")
    return user


def get_event(db: Session, event_id: int) -> GameEvent:
    event = db.get(GameEvent, event_id)
    if not event:
        raise HTTPException(404, "Evento no encontrado")
    return event


def participant_for(db: Session, event_id: int, user_id: int, lock: bool = False) -> EventParticipant | None:
    statement = select(EventParticipant).where(
        EventParticipant.event_id == event_id,
        EventParticipant.user_id == user_id,
    )
    if lock:
        statement = statement.with_for_update()
    return db.scalar(statement)


def require_event_access(db: Session, event_id: int, user: User, lock_participant: bool = False) -> tuple[GameEvent, EventParticipant | None]:
    event = get_event(db, event_id)
    participant = participant_for(db, event_id, user.id, lock=lock_participant)
    if not participant and not user.is_admin:
        raise HTTPException(403, "Únete al evento para ver su portal")
    return event, participant


def require_event_admin(db: Session, event_id: int, user: User) -> GameEvent:
    if not user.is_admin:
        raise HTTPException(403, "Se requiere una cuenta de organización")
    event = get_event(db, event_id)
    if event_status(event) == "ended":
        raise HTTPException(409, "El evento ya terminó")
    return event


def event_status(event: GameEvent) -> str:
    if event.status == "ended":
        return "ended"
    now, starts, ends = utc_now(), as_utc(event.starts_at), as_utc(event.ends_at)
    if ends and ends <= now:
        return "ended"
    if event.status == "live":
        return "scheduled" if starts and starts > now else "live"
    return "draft"


def event_open(event: GameEvent) -> bool:
    return event_status(event) == "live"


def duplicate_code(db: Session, model, code: str) -> bool:
    return bool(db.scalar(select(model.id).where(model.join_code == code)))


def make_unique_code(db: Session, model, length: int = 7) -> str:
    for _ in range(10):
        code = random_code(length)
        if not duplicate_code(db, model, code):
            return code
    raise HTTPException(503, "No se pudo generar un código; vuelve a intentarlo")


def scoreboard(db: Session, event: GameEvent) -> list[dict]:
    if event.mode == "solo":
        aggregates = (
            select(
                Solve.user_id.label("entity_id"),
                func.sum(Solve.awarded_points).label("score"),
                func.count(Solve.id).label("solves"),
                func.max(Solve.solved_at).label("last_solve"),
            )
            .where(Solve.event_id == event.id)
            .group_by(Solve.user_id)
            .subquery()
        )
        rows = db.execute(
            select(
                User.id,
                User.display_name,
                func.coalesce(aggregates.c.score, 0),
                func.coalesce(aggregates.c.solves, 0),
                aggregates.c.last_solve,
            )
            .join(EventParticipant, EventParticipant.user_id == User.id)
            .outerjoin(aggregates, aggregates.c.entity_id == User.id)
            .where(EventParticipant.event_id == event.id)
        ).all()
        results = [
            {"id": f"user:{user_id}", "name": name, "kind": "user", "score": int(score), "solves": int(solves), "last_solve": last_solve.isoformat() if last_solve else None}
            for user_id, name, score, solves, last_solve in rows
        ]
    else:
        aggregates = (
            select(
                Solve.team_id.label("entity_id"),
                func.sum(Solve.awarded_points).label("score"),
                func.count(Solve.id).label("solves"),
                func.max(Solve.solved_at).label("last_solve"),
            )
            .where(Solve.event_id == event.id, Solve.team_id.is_not(None))
            .group_by(Solve.team_id)
            .subquery()
        )
        rows = db.execute(
            select(
                Team.id,
                Team.name,
                func.coalesce(aggregates.c.score, 0),
                func.coalesce(aggregates.c.solves, 0),
                aggregates.c.last_solve,
            )
            .outerjoin(aggregates, aggregates.c.entity_id == Team.id)
            .where(Team.event_id == event.id)
        ).all()
        results = [
            {"id": f"team:{team_id}", "name": name, "kind": "team", "score": int(score), "solves": int(solves), "last_solve": last_solve.isoformat() if last_solve else None}
            for team_id, name, score, solves, last_solve in rows
        ]
    results.sort(key=lambda item: (-item["score"], -item["solves"], item["name"].casefold()))
    for index, item in enumerate(results, 1):
        item["rank"] = index
    return results


def checkpoint_snapshot(db: Session, event: GameEvent) -> dict:
    solves = db.scalars(select(Solve).where(Solve.event_id == event.id).order_by(Solve.solved_at.asc())).all()
    challenges = db.scalars(select(Challenge).where(Challenge.event_id == event.id)).all()
    participants = db.scalars(select(EventParticipant).where(EventParticipant.event_id == event.id)).all()
    return {
        "version": 1,
        "captured_at": utc_now().isoformat(),
        "event": {"id": event.id, "title": event.title, "mode": event.mode, "status": event_status(event), "starts_at": event.starts_at.isoformat() if event.starts_at else None, "ends_at": event.ends_at.isoformat() if event.ends_at else None},
        "scoreboard": scoreboard(db, event),
        "solves": [{"challenge_id": row.challenge_id, "user_id": row.user_id, "team_id": row.team_id, "points": row.awarded_points, "solved_at": row.solved_at.isoformat() if row.solved_at else None} for row in solves],
        "challenges": [{"id": row.id, "title": row.title, "category": row.category, "scoring_mode": row.scoring_mode, "points": row.points, "minimum_points": row.minimum_points, "decay_per_solve": row.decay_per_solve, "active": row.active} for row in challenges],
        "participants": [{"user_id": row.user_id, "team_id": row.team_id} for row in participants],
    }


def _fingerprint(value: str) -> str:
    key = os.getenv("FLAG_PEPPER", "development-only-change-me").encode()
    return hmac.new(key, value.encode("utf-8", "replace"), hashlib.sha256).hexdigest()


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _require_rate(key: str, limit: int, window: int = 60) -> None:
    if not rate_limiter.consume(_fingerprint(key), limit, window):
        wait_minutes = max(1, (window + 59) // 60)
        raise HTTPException(429, f"Demasiadas solicitudes; espera {wait_minutes} min", headers={"Retry-After": str(window)})


@app.middleware("http")
async def browser_security(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin:
            parsed_origin = urlsplit(origin)
            expected_host = request.headers.get("host", request.url.netloc)
            if parsed_origin.scheme not in {"http", "https"} or parsed_origin.netloc != expected_host:
                return Response("Origen no permitido", status_code=403)
        if request.cookies.get("labcentral_session"):
            cookie_token = request.cookies.get("labcentral_csrf")
            header_token = request.headers.get("x-csrf-token")
            if not cookie_token or not header_token or not hmac.compare_digest(cookie_token, header_token):
                return Response("Token CSRF no válido", status_code=403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'"
    if os.getenv("COOKIE_SECURE", "0").lower() in {"1", "true", "yes"}:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/")
def home():
    return FileResponse(APP_DIR / "static" / "index.html")


@app.get("/api/status")
def status(db: Annotated[Session, Depends(get_db)]):
    return {"setup_required": db.scalar(select(func.count(User.id))) == 0}


@app.get("/health/live")
def health_live():
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready(db: Annotated[Session, Depends(get_db)]):
    db.execute(text("SELECT 1"))
    return {"status": "ready"}


@app.post("/api/setup")
def setup(payload: SetupInput, request: Request, response: Response, db: Annotated[Session, Depends(get_db)]):
    _require_rate(f"setup-ip:{_client_key(request)}", 10, 3600)
    setup_key = os.getenv("SETUP_KEY", "")
    if not setup_key or not hmac.compare_digest(payload.setup_key, setup_key):
        raise HTTPException(403, "Clave de instalación incorrecta")
    if db.scalar(select(func.count(User.id))) != 0:
        raise HTTPException(409, "La instalación inicial ya se completó")
    username = normalized_username(payload.username)
    user = User(username=username, display_name=payload.display_name.strip(), email=payload.email, password_hash=hash_password(payload.password), is_admin=True)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "La instalación inicial ya fue completada")
    db.refresh(user)
    create_login_session(response, db, user)
    return {"id": user.id, "username": user.username, "display_name": user.display_name, "email": user.email, "is_admin": True}


@app.post("/api/register")
def register(payload: RegisterInput, request: Request, response: Response, db: Annotated[Session, Depends(get_db)]):
    if db.scalar(select(func.count(User.id))) == 0:
        raise HTTPException(409, "Primero crea la cuenta organizadora desde la instalación inicial")
    client_key = _client_key(request)
    _require_rate(f"registration-ip:{client_key}", 180)
    event = db.scalar(select(GameEvent).where(GameEvent.join_code == payload.event_code.strip().upper()))
    if not event or event_status(event) == "ended":
        _require_rate(f"invite-ip:{client_key}", 30)
        raise HTTPException(404, "Código de evento no válido o evento finalizado")
    username = normalized_username(payload.username)
    if db.scalar(select(User.id).where(User.username == username)):
        raise HTTPException(409, "Ese nombre de usuario ya está en uso")
    user = User(username=username, display_name=payload.display_name.strip(), email=payload.email, password_hash=hash_password(payload.password), is_admin=False)
    db.add(user)
    try:
        db.flush()
        db.add(EventParticipant(event_id=event.id, user_id=user.id))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ese usuario o correo ya está en uso")
    db.refresh(user)
    create_login_session(response, db, user)
    event_stream.publish_from_thread(event.id, {"type": "participant_changed"})
    return {"id": user.id, "username": user.username, "display_name": user.display_name, "email": user.email, "is_admin": False, "event_id": event.id}


@app.post("/api/login")
def login(payload: LoginInput, request: Request, response: Response, db: Annotated[Session, Depends(get_db)]):
    client_key = _client_key(request)
    username = payload.username.strip().lower()
    _require_rate(f"login-ip:{client_key}", 120)
    _require_rate(f"login-name:{username}", 60, 900)
    user = db.scalar(select(User).where(User.username == username))
    valid_password = verify_password(payload.password, user.password_hash if user else DUMMY_PASSWORD_HASH)
    if not user or not valid_password:
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    create_login_session(response, db, user)
    return {"id": user.id, "username": user.username, "display_name": user.display_name, "email": user.email, "is_admin": user.is_admin}


@app.post("/api/password/forgot", status_code=202)
def forgot_password(payload: ForgotPasswordInput, request: Request, db: Annotated[Session, Depends(get_db)]):
    client_key = _client_key(request)
    _require_rate(f"password-reset-ip:{client_key}", 20, 3600)
    _require_rate(f"password-reset-email:{payload.email}", 5, 3600)
    user = db.scalar(select(User).where(User.email == payload.email))
    if user and mailer_configured():
        token = new_session_token()
        db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
        db.add(PasswordResetToken(user_id=user.id, token_digest=digest_session(token), expires_at=utc_now() + timedelta(minutes=30)))
        db.commit()
        try:
            send_password_reset(user.email, token)
        except (smtplib.SMTPException, OSError, ValueError):
            db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
            db.commit()
            logger.warning("No se pudo entregar un correo de recuperación")
    return {"message": "Si la cuenta existe y el correo está configurado, recibirás un enlace de recuperación."}


@app.post("/api/password/reset")
def reset_password(payload: ResetPasswordInput, request: Request, db: Annotated[Session, Depends(get_db)]):
    _require_rate(f"password-reset-complete:{_client_key(request)}", 30, 3600)
    token = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_digest == digest_session(payload.token)).with_for_update())
    if not token or token.used_at or as_utc(token.expires_at) <= utc_now():
        raise HTTPException(400, "El enlace no es válido o ya venció; solicita otro.")
    user = db.get(User, token.user_id)
    if not user:
        raise HTTPException(400, "El enlace no es válido o ya venció; solicita otro.")
    token.used_at = utc_now()
    user.password_hash = hash_password(payload.password)
    db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id, PasswordResetToken.id != token.id))
    db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
    db.commit()
    return {"ok": True, "message": "Contraseña actualizada. Inicia sesión con la nueva contraseña."}


@app.post("/api/logout")
def logout(request: Request, response: Response, db: Annotated[Session, Depends(get_db)]):
    token = request.cookies.get("labcentral_session")
    if token:
        session = db.scalar(select(LoginSession).where(LoginSession.token_digest == digest_session(token)))
        if session:
            db.delete(session)
            db.commit()
    response.delete_cookie("labcentral_session", path="/")
    response.delete_cookie("labcentral_csrf", path="/")
    return {"ok": True}


@app.get("/api/me")
def me(user: Annotated[User, Depends(require_user)]):
    return {"id": user.id, "username": user.username, "display_name": user.display_name, "email": user.email, "is_admin": user.is_admin}


@app.patch("/api/me/email")
def update_email(payload: EmailUpdateInput, user: Annotated[User, Depends(require_user)], db: Annotated[Session, Depends(get_db)]):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(401, "La contraseña actual no coincide")
    user.email = payload.email
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ese correo ya está asociado a otra cuenta")
    return {"email": user.email}


@app.get("/api/events")
def list_events(user: Annotated[User, Depends(require_user)], db: Annotated[Session, Depends(get_db)]):
    events = db.scalars(select(GameEvent).order_by(GameEvent.created_at.desc())).all()
    joined_event_ids = set(db.scalars(select(EventParticipant.event_id).where(EventParticipant.user_id == user.id)).all())
    result = []
    for event in events:
        joined = event.id in joined_event_ids
        if user.is_admin or joined:
            row = {"id": event.id, "title": event.title, "description": event.description, "mode": event.mode, "status": event_status(event), "starts_at": event.starts_at.isoformat() if event.starts_at else None, "ends_at": event.ends_at.isoformat() if event.ends_at else None, "joined": joined}
            if user.is_admin:
                row["join_code"] = event.join_code
            result.append(row)
    return result


@app.post("/api/events")
def create_event(payload: EventCreate, user: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    starts, ends = as_utc(payload.starts_at), as_utc(payload.ends_at)
    if starts and ends and ends <= starts:
        raise HTTPException(422, "La hora de término debe ser posterior al inicio")
    event = GameEvent(title=payload.title.strip(), description=payload.description.strip(), mode=payload.mode, status="draft", starts_at=starts, ends_at=ends, join_code=make_unique_code(db, GameEvent, 8))
    db.add(event)
    db.commit()
    db.refresh(event)
    return {"id": event.id, "title": event.title, "mode": event.mode, "status": event_status(event), "join_code": event.join_code, "starts_at": event.starts_at.isoformat() if event.starts_at else None, "ends_at": event.ends_at.isoformat() if event.ends_at else None}


@app.patch("/api/events/{event_id}")
def update_event(event_id: int, payload: EventPatch, user: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    event = require_event_admin(db, event_id, user)
    updates = payload.model_dump(exclude_unset=True)
    if "title" in updates and updates["title"] is None:
        raise HTTPException(422, "El título no puede ser nulo")
    if "description" in updates and updates["description"] is None:
        updates["description"] = ""
    for key, value in updates.items():
        setattr(event, key, as_utc(value) if key in {"starts_at", "ends_at"} else value.strip() if isinstance(value, str) else value)
    if event.starts_at and event.ends_at and as_utc(event.ends_at) <= as_utc(event.starts_at):
        raise HTTPException(422, "La hora de término debe ser posterior al inicio")
    db.commit()
    event_stream.publish_from_thread(event.id, {"type": "event_changed"})
    return {"id": event.id, "title": event.title, "status": event_status(event), "starts_at": event.starts_at.isoformat() if event.starts_at else None, "ends_at": event.ends_at.isoformat() if event.ends_at else None}


@app.post("/api/events/{event_id}/status")
def set_event_status(event_id: int, payload: EventStatusInput, user: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    event = get_event(db, event_id)
    if payload.status not in {"live", "ended"}:
        raise HTTPException(422, "El estado debe ser live o ended")
    if event.status == "ended":
        raise HTTPException(409, "El evento ya terminó")
    if payload.status == "live":
        event.status = "live"
    else:
        event.status = "ended"
    db.commit()
    event_stream.publish_from_thread(event.id, {"type": "event", "status": event_status(event)})
    return {"status": event_status(event)}


@app.post("/api/events/join")
def join_event(payload: JoinEventInput, request: Request, user: Annotated[User, Depends(require_user)], db: Annotated[Session, Depends(get_db)]):
    client_key = _client_key(request)
    _require_rate(f"invite-ip:{client_key}", 30)
    code = payload.code.strip().upper()
    event = db.scalar(select(GameEvent).where(GameEvent.join_code == code))
    if not event:
        _require_rate(f"invite-ip:{client_key}", 30)
        raise HTTPException(404, "Código de evento no válido")
    if event_status(event) == "ended":
        raise HTTPException(409, "El evento ya terminó")
    existing = participant_for(db, event.id, user.id)
    if existing:
        return {"event_id": event.id, "joined": True, "already_joined": True}
    db.add(EventParticipant(event_id=event.id, user_id=user.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    event_stream.publish_from_thread(event.id, {"type": "participant_changed"})
    return {"event_id": event.id, "joined": True}


@app.post("/api/events/{event_id}/teams")
def create_team(event_id: int, payload: TeamCreate, user: Annotated[User, Depends(require_user)], db: Annotated[Session, Depends(get_db)]):
    event, participant = require_event_access(db, event_id, user, lock_participant=True)
    if event.mode != "teams":
        raise HTTPException(409, "Este evento es individual")
    if not participant:
        raise HTTPException(403, "Únete al evento primero")
    if participant.team_id:
        raise HTTPException(409, "Ya perteneces a un equipo")
    team = Team(event_id=event.id, name=payload.name.strip(), join_code=make_unique_code(db, Team, 7))
    db.add(team)
    try:
        db.flush()
        participant.team_id = team.id
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ese nombre de equipo ya está en uso")
    event_stream.publish_from_thread(event.id, {"type": "scoreboard_changed"})
    return {"id": team.id, "name": team.name, "join_code": team.join_code}


@app.post("/api/events/{event_id}/teams/join")
def join_team(event_id: int, payload: TeamJoin, request: Request, user: Annotated[User, Depends(require_user)], db: Annotated[Session, Depends(get_db)]):
    event, participant = require_event_access(db, event_id, user, lock_participant=True)
    if event.mode != "teams" or not participant:
        raise HTTPException(409, "No puedes unirte a un equipo en este evento")
    if participant.team_id:
        raise HTTPException(409, "Ya perteneces a un equipo")
    client_key = _client_key(request)
    _require_rate(f"invite-ip:{client_key}", 30)
    team = db.scalar(select(Team).where(Team.event_id == event.id, Team.join_code == payload.code.strip().upper()))
    if not team:
        _require_rate(f"invite-ip:{client_key}", 30)
        raise HTTPException(404, "Código de equipo no válido para este evento")
    participant.team_id = team.id
    db.commit()
    event_stream.publish_from_thread(event.id, {"type": "scoreboard_changed"})
    return {"id": team.id, "name": team.name}


def challenge_public(db: Session, challenge: Challenge, solve_count: int | None = None, assets: list[ChallengeAsset] | None = None) -> dict:
    if solve_count is None:
        solve_count = db.scalar(select(func.count(Solve.id)).where(Solve.challenge_id == challenge.id)) or 0
    if assets is None:
        assets = db.scalars(select(ChallengeAsset).where(ChallengeAsset.challenge_id == challenge.id).order_by(ChallengeAsset.created_at)).all()
    next_points = points_for(challenge.scoring_mode, ScorePolicy(challenge.points, challenge.minimum_points, challenge.decay_per_solve), solve_count)
    return {"id": challenge.id, "title": challenge.title, "category": challenge.category, "description": challenge.description, "scoring_mode": challenge.scoring_mode, "points": challenge.points, "minimum_points": challenge.minimum_points, "decay_per_solve": challenge.decay_per_solve, "next_points": next_points, "solves": solve_count, "active": challenge.active, "assets": [{"id": item.id, "name": item.original_name, "size_bytes": item.size_bytes, "download_url": f"/api/events/{item.event_id}/assets/{item.id}"} for item in assets]}


@app.get("/api/events/{event_id}/dashboard")
def event_dashboard(event_id: int, user: Annotated[User, Depends(require_user)], db: Annotated[Session, Depends(get_db)]):
    event, participant = require_event_access(db, event_id, user)
    challenges = db.scalars(select(Challenge).where(Challenge.event_id == event.id, Challenge.active.is_(True)).order_by(Challenge.category, Challenge.id)).all()
    solve_counts = dict(db.execute(
        select(Solve.challenge_id, func.count(Solve.id))
        .where(Solve.event_id == event.id)
        .group_by(Solve.challenge_id)
    ).all())
    asset_rows = db.scalars(select(ChallengeAsset).where(ChallengeAsset.event_id == event.id).order_by(ChallengeAsset.created_at)).all()
    assets_by_challenge: dict[int, list[ChallengeAsset]] = {}
    for asset in asset_rows:
        assets_by_challenge.setdefault(asset.challenge_id, []).append(asset)
    solve_query = select(Solve).where(Solve.event_id == event.id)
    if event.mode == "teams" and participant and participant.team_id:
        solve_query = solve_query.where(Solve.team_id == participant.team_id)
    else:
        solve_query = solve_query.where(Solve.user_id == user.id)
    my_solves = db.scalars(solve_query.order_by(Solve.solved_at.desc())).all()
    team = db.get(Team, participant.team_id) if participant and participant.team_id else None
    team_size = 0
    if team:
        team_size = db.scalar(select(func.count(EventParticipant.id)).where(EventParticipant.team_id == team.id)) or 0
    public_event = {"id": event.id, "title": event.title, "description": event.description, "mode": event.mode, "status": event_status(event), "starts_at": event.starts_at.isoformat() if event.starts_at else None, "ends_at": event.ends_at.isoformat() if event.ends_at else None, "join_code": event.join_code if user.is_admin else None}
    return {
        "event": public_event,
        "is_admin": user.is_admin,
        "participant": bool(participant),
        "team": {"id": team.id, "name": team.name, "join_code": team.join_code, "size": team_size} if team else None,
        "challenges": [challenge_public(db, item, solve_counts.get(item.id, 0), assets_by_challenge.get(item.id, [])) for item in challenges],
        "solves": [{"challenge_id": row.challenge_id, "points": row.awarded_points, "solved_at": row.solved_at.isoformat() if row.solved_at else None} for row in my_solves],
        "scoreboard": scoreboard(db, event),
        "participant_count": db.scalar(select(func.count(EventParticipant.id)).where(EventParticipant.event_id == event.id)) or 0,
    }


@app.post("/api/events/{event_id}/challenges")
def create_challenge(event_id: int, payload: ChallengeCreate, user: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    event = require_event_admin(db, event_id, user)
    if (db.scalar(select(func.count(Challenge.id)).where(Challenge.event_id == event.id)) or 0) >= 500:
        raise HTTPException(409, "Este evento alcanzó el límite de 500 retos")
    if payload.minimum_points > payload.points:
        raise HTTPException(422, "El mínimo no puede superar el puntaje inicial")
    challenge = Challenge(event_id=event.id, title=payload.title.strip(), category=payload.category.strip(), description=payload.description.strip(), flag_digest=flag_digest(payload.flag), scoring_mode=payload.scoring_mode, points=payload.points, minimum_points=payload.minimum_points, decay_per_solve=payload.decay_per_solve)
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    event_stream.publish_from_thread(event.id, {"type": "challenge_changed"})
    return challenge_public(db, challenge)


@app.patch("/api/events/{event_id}/challenges/{challenge_id}")
def update_challenge(event_id: int, challenge_id: int, payload: ChallengePatch, user: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    event = require_event_admin(db, event_id, user)
    challenge = db.scalar(select(Challenge).where(Challenge.id == challenge_id, Challenge.event_id == event.id))
    if not challenge:
        raise HTTPException(404, "Reto no encontrado")
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("flag") is not None:
        challenge.flag_digest = flag_digest(updates["flag"])
    updates.pop("flag", None)
    for key, value in updates.items():
        if value is not None:
            setattr(challenge, key, value.strip() if isinstance(value, str) else value)
    if challenge.minimum_points > challenge.points:
        raise HTTPException(422, "El mínimo no puede superar el puntaje inicial")
    db.commit()
    event_stream.publish_from_thread(event.id, {"type": "challenge_changed"})
    return challenge_public(db, challenge)


@app.delete("/api/events/{event_id}/challenges/{challenge_id}")
def delete_challenge(event_id: int, challenge_id: int, user: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    event = require_event_admin(db, event_id, user)
    challenge = db.scalar(select(Challenge).where(Challenge.id == challenge_id, Challenge.event_id == event.id))
    if not challenge:
        raise HTTPException(404, "Reto no encontrado")
    challenge.active = False
    assets = db.scalars(select(ChallengeAsset).where(ChallengeAsset.challenge_id == challenge.id)).all()
    asset_paths = [ASSET_DIR / str(event.id) / asset.storage_key for asset in assets]
    for asset in assets:
        db.delete(asset)
    db.commit()
    for path in asset_paths:
        path.unlink(missing_ok=True)
    event_stream.publish_from_thread(event.id, {"type": "challenge_changed"})
    return {"ok": True}


def _copy_limited_upload(upload: UploadFile, destination: Path) -> tuple[int, str]:
    temporary = destination.with_suffix(".partial")
    total = 0
    digest = hashlib.sha256()
    try:
        with temporary.open("xb") as output:
            while chunk := upload.file.read(64 * 1024):
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise ValueError("El archivo supera el límite de 5 MiB")
                digest.update(chunk)
                output.write(chunk)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, 0o644)
        os.replace(temporary, destination)
        return total, digest.hexdigest()
    except Exception:
        temporary.unlink(missing_ok=True)
        destination.unlink(missing_ok=True)
        raise


@app.post("/api/events/{event_id}/challenges/{challenge_id}/assets", status_code=201)
async def upload_challenge_asset(
    event_id: int,
    challenge_id: int,
    request: Request,
    user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    event = require_event_admin(db, event_id, user)
    challenge = db.scalar(select(Challenge).where(Challenge.id == challenge_id, Challenge.event_id == event.id))
    if not challenge:
        raise HTTPException(404, "Reto no encontrado")
    _require_rate(f"asset-upload-user:{user.id}", 20, 3600)
    try:
        event_quota = int(os.getenv("ASSET_EVENT_QUOTA_BYTES", str(1024 * 1024 * 1024)))
    except ValueError:
        raise HTTPException(503, "La cuota de almacenamiento está mal configurada")
    form = await request.form(max_files=1, max_fields=1, max_part_size=4096)
    try:
        upload = form.get("file")
        if set(form.keys()) != {"file"} or len(form.getlist("file")) != 1 or not isinstance(upload, UploadFile):
            raise HTTPException(422, "Adjunta un archivo en el campo file")
        if upload.size is not None and upload.size > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "El archivo supera el límite de 5 MiB")
        name = (upload.filename or "").replace("\\", "/").split("/")[-1].strip()
        name = re.sub(r"[\x00-\x1f\x7f]", "", name)[:180]
        suffix = Path(name).suffix.lower()
        if not name or suffix not in UPLOAD_EXTENSIONS:
            raise HTTPException(415, "Tipo de archivo no permitido")
        storage_key = f"{uuid.uuid4().hex}.blob"
        folder = ASSET_DIR / str(event.id)
        try:
            await run_in_threadpool(folder.mkdir, parents=True, exist_ok=True, mode=0o755)
            target = folder / storage_key
            size, checksum = await run_in_threadpool(_copy_limited_upload, upload, target)
            locked_event = db.scalar(select(GameEvent).where(GameEvent.id == event.id).with_for_update())
            if not locked_event or event_status(locked_event) == "ended":
                target.unlink(missing_ok=True)
                raise HTTPException(409, "El evento ya no admite cambios")
            challenge = db.scalar(select(Challenge).where(Challenge.id == challenge_id, Challenge.event_id == event.id).with_for_update())
            if not challenge or not challenge.active:
                target.unlink(missing_ok=True)
                raise HTTPException(404, "Reto no encontrado o inactivo")
            challenge_asset_count = db.scalar(select(func.count(ChallengeAsset.id)).where(ChallengeAsset.challenge_id == challenge.id)) or 0
            event_asset_count = db.scalar(select(func.count(ChallengeAsset.id)).where(ChallengeAsset.event_id == event.id)) or 0
            current_bytes = db.scalar(select(func.coalesce(func.sum(ChallengeAsset.size_bytes), 0)).where(ChallengeAsset.event_id == event.id)) or 0
            if challenge_asset_count >= 20:
                target.unlink(missing_ok=True)
                raise HTTPException(409, "Este reto alcanzó el límite de 20 archivos")
            if event_asset_count >= 1000:
                target.unlink(missing_ok=True)
                raise HTTPException(409, "Este evento alcanzó el límite de 1.000 archivos")
            if current_bytes + size > event_quota:
                target.unlink(missing_ok=True)
                raise HTTPException(409, "El almacenamiento de archivos de este evento está lleno")
            asset = ChallengeAsset(event_id=event.id, challenge_id=challenge.id, uploaded_by=user.id, storage_key=storage_key, original_name=name, media_type="application/octet-stream", size_bytes=size, sha256=checksum)
            db.add(asset)
            db.commit()
            try:
                await event_stream.publish(event.id, {"type": "challenge_changed"})
            except Exception as error:
                logger.warning("Adjunto guardado pero no se pudo notificar el cambio (%s)", type(error).__name__)
        except ValueError as error:
            raise HTTPException(413, str(error))
        except HTTPException:
            raise
        except OSError as error:
            logger.warning("No se pudo guardar un adjunto de reto (%s)", type(error).__name__)
            raise HTTPException(507, "No se pudo guardar el archivo; revisa el espacio disponible")
        except IntegrityError:
            db.rollback()
            (folder / storage_key).unlink(missing_ok=True)
            raise HTTPException(503, "No se pudo registrar el archivo; vuelve a intentarlo")
        except SQLAlchemyError:
            db.rollback()
            (folder / storage_key).unlink(missing_ok=True)
            raise
        return {"id": asset.id, "name": asset.original_name, "size_bytes": asset.size_bytes, "sha256": asset.sha256, "download_url": f"/api/events/{event.id}/assets/{asset.id}"}

    finally:
        await form.close()

@app.get("/api/events/{event_id}/assets/{asset_id}")
def download_challenge_asset(event_id: int, asset_id: int, user: Annotated[User, Depends(require_user)], db: Annotated[Session, Depends(get_db)]):
    event, _participant = require_event_access(db, event_id, user)
    asset = db.scalar(select(ChallengeAsset).where(ChallengeAsset.id == asset_id, ChallengeAsset.event_id == event.id))
    if not asset:
        raise HTTPException(404, "Archivo no encontrado")
    challenge = db.get(Challenge, asset.challenge_id)
    if not challenge or (not challenge.active and not user.is_admin):
        raise HTTPException(404, "Archivo no encontrado")
    path = ASSET_DIR / str(event.id) / asset.storage_key
    if not path.is_file():
        logger.error("Falta el contenido de un adjunto registrado (event=%s asset=%s)", event.id, asset.id)
        raise HTTPException(503, "El archivo no está disponible temporalmente")
    return FileResponse(path, media_type="application/octet-stream", filename=asset.original_name, headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"})


@app.delete("/api/events/{event_id}/assets/{asset_id}")
def delete_challenge_asset(event_id: int, asset_id: int, user: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    event = require_event_admin(db, event_id, user)
    asset = db.scalar(select(ChallengeAsset).where(ChallengeAsset.id == asset_id, ChallengeAsset.event_id == event.id))
    if not asset:
        raise HTTPException(404, "Archivo no encontrado")
    path = ASSET_DIR / str(event.id) / asset.storage_key
    db.delete(asset)
    db.commit()
    path.unlink(missing_ok=True)
    event_stream.publish_from_thread(event.id, {"type": "challenge_changed"})
    return {"ok": True}


@app.post("/api/events/{event_id}/submit")
def submit_flag(event_id: int, payload: SubmitInput, user: Annotated[User, Depends(require_user)], db: Annotated[Session, Depends(get_db)]):
    event, participant = require_event_access(db, event_id, user, lock_participant=True)
    if not participant:
        raise HTTPException(403, "Únete al evento para enviar respuestas")
    if not event_open(event):
        raise HTTPException(409, "El evento no está recibiendo respuestas")
    if event.mode == "teams" and not participant.team_id:
        raise HTTPException(409, "Crea o únete a un equipo antes de enviar respuestas")
    _require_rate(f"submission-user:{user.id}", SUBMISSION_LIMIT)
    challenge = db.scalar(select(Challenge).where(Challenge.id == payload.challenge_id, Challenge.event_id == event.id).with_for_update())
    if not challenge or not challenge.active:
        raise HTTPException(404, "Reto no encontrado o inactivo")
    solver_key = f"team:{participant.team_id}" if event.mode == "teams" else f"user:{user.id}"
    solved = db.scalar(select(Solve.id).where(Solve.challenge_id == challenge.id, Solve.solver_key == solver_key))
    if solved:
        return {"correct": True, "already_solved": True, "message": "Este reto ya está resuelto"}
    correct = verify_flag(payload.flag, challenge.flag_digest)
    db.add(SubmissionAttempt(event_id=event.id, challenge_id=challenge.id, user_id=user.id, correct=correct))
    if not correct:
        db.flush()
        cutoff = utc_now() - timedelta(minutes=10)
        failed_count = db.scalar(select(func.count(SubmissionAttempt.id)).where(
            SubmissionAttempt.event_id == event.id,
            SubmissionAttempt.user_id == user.id,
            SubmissionAttempt.correct.is_(False),
            SubmissionAttempt.attempted_at >= cutoff,
        )) or 0
        recent_signal = db.scalar(select(IntegritySignal.id).where(
            IntegritySignal.event_id == event.id,
            IntegritySignal.user_id == user.id,
            IntegritySignal.kind == "repeated_invalid_flags",
            IntegritySignal.created_at >= utc_now() - timedelta(minutes=30),
        ))
        if failed_count >= 5 and not recent_signal:
            db.add(IntegritySignal(event_id=event.id, user_id=user.id, kind="repeated_invalid_flags", details={"failed_attempts": int(failed_count), "window_minutes": 10}))
        db.commit()
        return {"correct": False, "message": "La flag no coincide"}
    prior_solves = db.scalar(select(func.count(Solve.id)).where(Solve.challenge_id == challenge.id)) or 0
    award = points_for(challenge.scoring_mode, ScorePolicy(challenge.points, challenge.minimum_points, challenge.decay_per_solve), prior_solves)
    solve = Solve(event_id=event.id, challenge_id=challenge.id, user_id=user.id, team_id=participant.team_id, solver_key=solver_key, awarded_points=award)
    db.add(solve)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"correct": True, "already_solved": True, "message": "Este reto ya está resuelto"}
    event_stream.publish_from_thread(event.id, {"type": "scoreboard_changed"})
    return {"correct": True, "awarded_points": award, "message": f"¡Correcto! +{award} puntos"}


@app.get("/api/events/{event_id}/export.csv")
def export_results(event_id: int, user: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    event = get_event(db, event_id)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["rango", "participante", "tipo", "puntaje", "retos_resueltos", "ultimo_reto"])
    def safe_csv(value):
        text = str(value)
        return "'" + text if text.startswith(("=", "+", "-", "@", "\t", "\r")) else text
    for row in scoreboard(db, event):
        writer.writerow([row["rank"], safe_csv(row["name"]), row["kind"], row["score"], row["solves"], row["last_solve"] or ""])
    output.seek(0)
    filename = f"labcentral-event-{event.id}-results.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@app.get("/api/events/{event_id}/integrity")
def list_integrity_signals(event_id: int, user: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    get_event(db, event_id)
    rows = db.execute(
        select(IntegritySignal, User.username, User.display_name)
        .join(User, User.id == IntegritySignal.user_id)
        .where(IntegritySignal.event_id == event_id)
        .order_by(IntegritySignal.created_at.desc())
        .limit(500)
    ).all()
    return [{"id": signal.id, "kind": signal.kind, "details": signal.details, "created_at": signal.created_at.isoformat(), "username": username, "display_name": display_name} for signal, username, display_name in rows]


@app.get("/api/events/{event_id}/integrity.csv")
def export_integrity_signals(event_id: int, user: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    get_event(db, event_id)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["fecha_utc", "usuario", "señal", "detalle"])
    rows = db.execute(
        select(IntegritySignal, User.username)
        .join(User, User.id == IntegritySignal.user_id)
        .where(IntegritySignal.event_id == event_id)
        .order_by(IntegritySignal.created_at.desc())
        .limit(10_000)
    ).all()
    for signal, username in rows:
        writer.writerow([signal.created_at.isoformat(), username, signal.kind, json.dumps(signal.details, ensure_ascii=False)])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="labcentral-event-{event_id}-integrity.csv"'})


@app.post("/api/events/{event_id}/checkpoints")
def create_checkpoint(event_id: int, user: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    event = get_event(db, event_id)
    checkpoint = EventCheckpoint(event_id=event.id, created_by=user.id, snapshot=checkpoint_snapshot(db, event))
    db.add(checkpoint)
    db.flush()
    stale_ids = db.scalars(
        select(EventCheckpoint.id)
        .where(EventCheckpoint.event_id == event.id)
        .order_by(EventCheckpoint.created_at.desc(), EventCheckpoint.id.desc())
        .offset(20)
    ).all()
    if stale_ids:
        db.execute(delete(EventCheckpoint).where(EventCheckpoint.id.in_(stale_ids)))
    db.commit()
    db.refresh(checkpoint)
    return {"id": checkpoint.id, "created_at": checkpoint.created_at.isoformat() if checkpoint.created_at else None}


@app.get("/api/events/{event_id}/checkpoints")
def list_checkpoints(event_id: int, user: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    get_event(db, event_id)
    rows = db.scalars(select(EventCheckpoint).where(EventCheckpoint.event_id == event_id).order_by(EventCheckpoint.created_at.desc())).all()
    return [{"id": row.id, "created_at": row.created_at.isoformat() if row.created_at else None, "solve_count": len(row.snapshot.get("solves", []))} for row in rows]


@app.get("/api/events/{event_id}/checkpoints/{checkpoint_id}")
def get_checkpoint(event_id: int, checkpoint_id: int, user: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    row = db.scalar(select(EventCheckpoint).where(EventCheckpoint.id == checkpoint_id, EventCheckpoint.event_id == event_id))
    if not row:
        raise HTTPException(404, "Checkpoint no encontrado")
    return row.snapshot


@app.post("/api/events/{event_id}/checkpoints/{checkpoint_id}/restore")
def restore_checkpoint(event_id: int, checkpoint_id: int, user: Annotated[User, Depends(require_admin)], db: Annotated[Session, Depends(get_db)]):
    event = get_event(db, event_id)
    checkpoint = db.scalar(select(EventCheckpoint).where(EventCheckpoint.id == checkpoint_id, EventCheckpoint.event_id == event_id))
    if not checkpoint:
        raise HTTPException(404, "Checkpoint no encontrado")
    snapshot = checkpoint.snapshot
    if snapshot.get("event", {}).get("id") != event.id:
        raise HTTPException(409, "El checkpoint no corresponde a este evento")
    challenge_ids = set(db.scalars(select(Challenge.id).where(Challenge.event_id == event.id)).all())
    if any(solve.get("challenge_id") not in challenge_ids for solve in snapshot.get("solves", [])):
        raise HTTPException(409, "No se puede restaurar: faltan retos del checkpoint")
    db.execute(delete(Solve).where(Solve.event_id == event.id))
    for saved in snapshot.get("solves", []):
        team_id = saved.get("team_id")
        user_id = saved.get("user_id")
        solver_key = f"team:{team_id}" if event.mode == "teams" and team_id is not None else f"user:{user_id}"
        solved_at = datetime.fromisoformat(saved["solved_at"]) if saved.get("solved_at") else utc_now()
        db.add(Solve(event_id=event.id, challenge_id=saved["challenge_id"], user_id=user_id, team_id=team_id, solver_key=solver_key, awarded_points=saved["points"], solved_at=as_utc(solved_at)))
    db.commit()
    event_stream.publish_from_thread(event.id, {"type": "scoreboard_changed"})
    return {"ok": True, "restored_solves": len(snapshot.get("solves", []))}


@app.websocket("/ws/events/{event_id}")
async def event_socket(websocket: WebSocket, event_id: int):
    origin = websocket.headers.get("origin")
    parsed_origin = urlsplit(origin or "")
    expected_host = websocket.headers.get("host", "")
    if parsed_origin.scheme not in {"http", "https"} or parsed_origin.netloc != expected_host:
        await websocket.close(code=4403)
        return
    token = websocket.cookies.get("labcentral_session")
    if not token:
        await websocket.close(code=4401)
        return

    def authorize_socket() -> bool:
        db = SessionLocal()
        try:
            session = db.scalar(select(LoginSession).where(LoginSession.token_digest == digest_session(token)))
            user = db.get(User, session.user_id) if session and as_utc(session.expires_at) > utc_now() else None
            participant = participant_for(db, event_id, user.id) if user else None
            event = db.get(GameEvent, event_id)
            return bool(user and event and (participant or user.is_admin))
        finally:
            db.close()

    if not await run_in_threadpool(authorize_socket):
        await websocket.close(code=4403)
        return
    await event_stream.subscribe(event_id, websocket)
    try:
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=300)
            except TimeoutError:
                if not await run_in_threadpool(authorize_socket):
                    await websocket.close(code=4401)
                    break
    except WebSocketDisconnect:
        pass
    finally:
        await event_stream.unsubscribe(event_id, websocket)
