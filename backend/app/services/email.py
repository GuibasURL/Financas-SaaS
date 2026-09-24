"""
Envio de e-mail por SMTP.

Sem SMTP configurado nenhum e-mail sai. Com o site local (localhost), o
conteúdo vai para o log da API, para dar para testar o "Esqueceu a senha?"
sem provedor. Com o site público, o log só avisa que não enviou: o link de
redefinição num log de servidor seria um risco (quem lê o log trocaria a
senha de qualquer um).
"""
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app import config
from app.config import is_public_origin

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, text: str) -> None:
    if not config.SMTP_HOST:
        if is_public_origin(config.FRONTEND_URL):
            logger.error("E-mail para %s não enviado: configure SMTP_HOST (e o resto do SMTP).", to)
        else:
            logger.warning("SMTP não configurado; e-mail que seria enviado para %s:\n%s\n%s", to, subject, text)
        return

    message = EmailMessage()
    message["From"] = config.SMTP_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)

    try:
        if config.SMTP_SECURITY == "ssl":
            server = smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, context=ssl.create_default_context(), timeout=15)
        else:
            server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15)
        with server:
            if config.SMTP_SECURITY == "starttls":
                server.starttls(context=ssl.create_default_context())
            if config.SMTP_USER:
                server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.send_message(message)
    except (smtplib.SMTPException, OSError):
        # Roda em segundo plano, depois da resposta: só registra o erro
        logger.exception("Falha ao enviar e-mail para %s", to)
