"""
Limite de tentativas de login erradas (contra quem tenta adivinhar senhas).

Conta as falhas numa janela de tempo deslizante, em duas chaves:
- e-mail + IP: quem erra a senha de uma conta várias vezes;
- só o IP: quem testa muitos e-mails diferentes a partir do mesmo lugar.

Estourou qualquer uma, o login fica bloqueado até a falha mais antiga sair da
janela. Login certo limpa as falhas daquela conta naquele IP.

Fica em memória: vale por processo e zera quando a API reinicia. Para uma
instância só (o caso do deploy deste projeto) é suficiente; com várias
instâncias, o contador precisaria ir para um lugar compartilhado (ex: Redis).
"""
import math
import time
from collections import deque
from typing import Callable


class LoginLimiter:
    def __init__(
        self,
        max_per_account: int,
        max_per_ip: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.max_per_account = max_per_account
        self.max_per_ip = max_per_ip
        self.window = window_seconds
        self.clock = clock
        self._failures: dict[tuple[str, ...], deque[float]] = {}

    def _recent(self, key: tuple[str, ...], now: float) -> deque[float]:
        """Falhas da chave ainda dentro da janela (descarta as antigas)."""
        failures = self._failures.get(key)
        if failures is None:
            return deque()
        while failures and failures[0] <= now - self.window:
            failures.popleft()
        if not failures:
            del self._failures[key]
        return failures

    def retry_after(self, email: str, ip: str) -> int:
        """Segundos até poder tentar de novo; 0 se o login está liberado."""
        now = self.clock()
        wait = 0.0
        for key, limit in (
            (("account", email, ip), self.max_per_account),
            (("ip", ip), self.max_per_ip),
        ):
            failures = self._recent(key, now)
            if len(failures) >= limit:
                # Libera quando a falha que estourou o limite sair da janela
                oldest_blocking = failures[len(failures) - limit]
                wait = max(wait, oldest_blocking + self.window - now)
        return math.ceil(wait)

    def record_failure(self, email: str, ip: str) -> None:
        now = self.clock()
        self._prune(now)
        for key in (("account", email, ip), ("ip", ip)):
            self._failures.setdefault(key, deque()).append(now)

    def record_success(self, email: str, ip: str) -> None:
        self._failures.pop(("account", email, ip), None)

    def reset(self) -> None:
        self._failures.clear()

    def _prune(self, now: float) -> None:
        # Sem isso, IPs que erraram uma vez e nunca voltaram ficariam na memória
        for key in list(self._failures):
            self._recent(key, now)
