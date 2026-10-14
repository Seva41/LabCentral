"""Small SMTP adapter; delivery is optional for LAN-only installations."""
from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage


def is_configured() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_FROM"))


def send_password_reset(recipient: str, token: str) -> None:
    host = os.environ["SMTP_HOST"]
    port = int(os.getenv("SMTP_PORT", "587"))
    sender = os.environ["SMTP_FROM"]
    public_url = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")
    message = EmailMessage()
    message["Subject"] = "Recupera tu contraseña de LabCentral 2"
    message["From"] = sender
    message["To"] = recipient
    message.set_content(
        "Recibimos una solicitud para restablecer tu contraseña. "
        "Abre este enlace dentro de los próximos 30 minutos:\n\n"
        f"{public_url}/#reset_token={token}\n\n"
        "Si no solicitaste este cambio, ignora este mensaje."
    )
    timeout = float(os.getenv("SMTP_TIMEOUT_SECONDS", "8"))
    username, password = os.getenv("SMTP_USERNAME"), os.getenv("SMTP_PASSWORD")
    if os.getenv("SMTP_USE_SSL", "false").lower() in {"1", "true", "yes"}:
        with smtplib.SMTP_SSL(host, port, timeout=timeout) as smtp:
            if username:
                smtp.login(username, password or "")
            smtp.send_message(message)
        return
    with smtplib.SMTP(host, port, timeout=timeout) as smtp:
        smtp.ehlo()
        if os.getenv("SMTP_STARTTLS", "true").lower() in {"1", "true", "yes"}:
            smtp.starttls()
            smtp.ehlo()
        if username:
            smtp.login(username, password or "")
        smtp.send_message(message)
