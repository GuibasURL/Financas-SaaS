"""
Força da senha no cadastro. A mesma regra está no frontend
(frontend/src/utils/passwordStrength.ts), que mostra a checklist enquanto a
pessoa digita; aqui ela é obrigatória, para valer também para quem chama a
API direto.

- Forte: pelo menos 8 caracteres e os 4 tipos (minúscula, maiúscula,
  número e caractere especial).
- Mediana: pelo menos 8 caracteres e 3 dos 4 tipos.
- Fraca: o resto, ou uma senha óbvia (ver obvious_reason). Não é aceita.
"""
from typing import Literal, Optional

from app.services.text import normalize_text

MIN_LENGTH = 8

Strength = Literal["weak", "medium", "strong"]

# Nome de cada tipo de caractere nas mensagens (mesma ordem da checklist da tela)
CHARACTER_TYPES = {
    "lower": "letra minúscula",
    "upper": "letra maiúscula",
    "digit": "número",
    "special": "caractere especial",
}

# Palavras de senhas comuns, comparadas com as LETRAS da senha (sem acento e
# em minúsculas): "Senha123!" -> "senha" é recusada, mas "senha-forte-123" ->
# "senhaforte" não. A mesma lista está no frontend; um teste confere que as
# duas batem (tests/test_password_policy.py).
COMMON_PASSWORDS = frozenset(
    {
        "admin", "administrador", "amor", "asdf", "asdfgh", "asdfghjkl", "bemvindo",
        "brasil", "corinthians", "deus", "dragon", "financas", "flamengo", "football",
        "futebol", "gremio", "iloveyou", "jesus", "letmein", "login", "master", "minhasenha",
        "monkey", "mudar", "mudarsenha", "palmeiras", "pass", "passw", "passwd", "password",
        "princesa", "qwerty", "qwertyuiop", "root", "santos", "saopaulo", "senha", "senhas",
        "sunshine", "teamo", "test", "teste", "trocar", "user", "usuario", "vasco", "vexira",
        "welcome", "zxcv", "zxcvbn",
    }
)

# Parte do e-mail (antes do @) menor que isso não é checada: "ana" pegaria "Banana"
MIN_EMAIL_PART = 4


def character_types(password: str) -> dict[str, bool]:
    """Quais tipos de caractere a senha tem. Letras acentuadas contam como letras."""
    return {
        "lower": any(c.islower() for c in password),
        "upper": any(c.isupper() for c in password),
        "digit": any(c.isdigit() for c in password),
        # Qualquer coisa que não seja letra, número ou espaço: !@#$%&*-_.,;?...
        "special": any(not c.isalnum() and not c.isspace() for c in password),
    }


# Símbolos usados no lugar de letras ("P@$$word"). Números ficam de fora de
# propósito: trocar 1->i, 0->o transformaria o "123" de "Senha123" em letras.
SYMBOL_AS_LETTER = str.maketrans({"@": "a", "$": "s"})


def _letters(text: str) -> str:
    """Só as letras, sem acento e em minúsculas: "P@ssword2024!" -> "password" """
    return "".join(c for c in normalize_text(text).translate(SYMBOL_AS_LETTER) if c.isalpha())


def _is_sequence_or_repeat(letters: str) -> bool:
    """"abcdef", "fedcba", "aaaa": fácil de adivinhar mesmo com números em volta"""
    if len(letters) < 4:
        return False
    steps = {ord(b) - ord(a) for a, b in zip(letters, letters[1:])}
    return steps in ({0}, {1}, {-1})


def obvious_reason(password: str, email: Optional[str] = None) -> Optional[str]:
    """Por que a senha é fácil de adivinhar, ou None se não é."""
    letters = _letters(password)
    if letters in COMMON_PASSWORDS:
        return "é uma senha muito comum"
    if _is_sequence_or_repeat(letters):
        return "é uma sequência ou repetição de letras"
    if email:
        email_part = _letters(email.split("@")[0])
        if len(email_part) >= MIN_EMAIL_PART and email_part in letters:
            return "contém o seu e-mail"
    return None


def password_strength(password: str, email: Optional[str] = None) -> Strength:
    types = sum(character_types(password).values())
    if len(password) < MIN_LENGTH or types < 3 or obvious_reason(password, email):
        return "weak"
    return "strong" if types == 4 else "medium"


def weak_password_message(password: str, email: Optional[str] = None) -> Optional[str]:
    """Mensagem explicando o que falta, ou None se a senha é aceita (mediana ou forte)."""
    if len(password) < MIN_LENGTH:
        return f"A senha precisa ter pelo menos {MIN_LENGTH} caracteres"
    missing = [name for key, name in CHARACTER_TYPES.items() if not character_types(password)[key]]
    if len(missing) > 1:
        return (
            "A senha está fraca: use pelo menos 3 destes tipos: letra minúscula, letra maiúscula, "
            f"número e caractere especial. Falta: {', '.join(missing)}."
        )
    reason = obvious_reason(password, email)
    if reason:
        return f"A senha é fácil de adivinhar: {reason}. Escolha outra."
    return None
