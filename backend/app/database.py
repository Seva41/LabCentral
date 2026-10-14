import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./labcentral.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
if not DATABASE_URL.startswith("sqlite"):
    connect_args = {
        "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "5")),
        "options": "-c statement_timeout=15000 -c idle_in_transaction_session_timeout=15000",
    }
engine_options = {"pool_pre_ping": True, "connect_args": connect_args}
if not DATABASE_URL.startswith("sqlite"):
    engine_options.update(
        pool_size=int(os.getenv("DB_POOL_SIZE", "20")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "10")),
        pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "5")),
        pool_recycle=1800,
    )
engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def enable_sqlite_safety(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
