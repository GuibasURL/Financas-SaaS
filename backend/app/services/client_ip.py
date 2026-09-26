"""
IP de quem acessa e se a conexão original era HTTPS, atrás de proxy.

No deploy (Render e afins) a API não recebe a conexão do visitante: recebe a
do proxy, que conta quem era o visitante no header X-Forwarded-For. Cada
proxy acrescenta, NO FIM da lista, o endereço de quem se conectou a ele:

    X-Forwarded-For: <o que o visitante mandou>, <visitante real>
                                                  ^ acrescentado pelo proxy

O começo da lista vem do visitante, que pode escrever o que quiser. Por isso
o IP é contado pela DIREITA, pulando só os proxies confiáveis
(TRUSTED_PROXY_HOPS). Pegar o primeiro da lista (o que o uvicorn faz com
--forwarded-allow-ips="*") deixaria qualquer um trocar de IP a cada
tentativa de login e escapar do limite de tentativas por IP.
"""
import logging

from fastapi import Request

from app import config

logger = logging.getLogger(__name__)

UNKNOWN_IP = "desconhecido"


def _forwarded(request: Request, header: str) -> list[str]:
    return [item.strip() for item in request.headers.get(header, "").split(",") if item.strip()]


def client_ip(request: Request) -> str:
    direct = request.client.host if request.client else UNKNOWN_IP
    hops = config.TRUSTED_PROXY_HOPS
    if hops <= 0:
        return direct

    forwarded = _forwarded(request, "x-forwarded-for")
    # Lista mais curta que o número de proxies: o pedido não passou por todos
    # eles (ou o header foi apagado); o IP direto é o único confiável
    ip = forwarded[-hops] if len(forwarded) >= hops else direct
    if config.LOG_CLIENT_IP:
        # Para descobrir TRUSTED_PROXY_HOPS no deploy (ver README); desligar depois
        logger.warning("X-Forwarded-For=%r direto=%s -> IP usado=%s", forwarded, direct, ip)
    return ip


def is_https(request: Request) -> bool:
    """Atrás do proxy a conexão com a API é HTTP; o proxy diz se a original era HTTPS."""
    if request.url.scheme == "https":
        return True
    if config.TRUSTED_PROXY_HOPS <= 0:
        return False
    proto = _forwarded(request, "x-forwarded-proto")
    return bool(proto) and proto[-1] == "https"
