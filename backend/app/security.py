from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets


PASSWORD_ITERATIONS = 600_000
FLAG_PEPPER = os.getenv("FLAG_PEPPER", "development-only-change-me")
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,40}$")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt.hex()}${derived.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt_hex, digest_hex = stored.split("$")
        if scheme != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations)).hex()
        return hmac.compare_digest(actual, digest_hex)
    except (ValueError, TypeError):
        return False


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def digest_session(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def csrf_token() -> str:
    return secrets.token_urlsafe(24)


def flag_digest(flag: str) -> str:
    return hmac.new(FLAG_PEPPER.encode(), flag.strip().encode(), hashlib.sha256).hexdigest()


def verify_flag(flag: str, digest: str) -> bool:
    return hmac.compare_digest(flag_digest(flag), digest)


def random_code(length: int = 7) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))
