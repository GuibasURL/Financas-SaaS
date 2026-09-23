"""
Força da senha no cadastro. A mesma regra está no frontend
(frontend/src/utils/passwordStrength.ts), que mostra a checklist enquanto a
pessoa digita; aqui ela é obrigatória, para valer também para quem chama a
API direto.

- Forte: pelo menos 8 caracteres e os 4 tipos (minúscula, maiúscula,
  número e caractere especial).
- Mediana: pelo menos 8 caracteres e 3 dos 4 tipos.
- Fraca: o resto. Não é aceita no cadastro.
"""
from typing import Literal

MIN_LENGTH = 8

Strength = Literal["weak", "medium", "strong"]

# Nome de cada tipo de caractere nas mensagens (mesma ordem da checklist da tela)
CHARACTER_TYPES = {
    "lower": "letra minúscula",
    "upper": "letra maiúscula",
    "digit": "número",
    "special": "caractere especial",
}


def character_types(password: str) -> dict[str, bool]:
    """Quais tipos de caractere a senha tem. Letras acentuadas contam como letras."""
    return {
        "lower": any(c.islower() for c in password),
        "upper": any(c.isupper() for c in password),
        "digit": any(c.isdigit() for c in password),
        # Qualquer coisa que não seja letra, número ou espaço: !@#$%&*-_.,;?...
        "special": any(not c.isalnum() and not c.isspace() for c in password),
    }


def password_strength(password: str) -> Strength:
    types = sum(character_types(password).values())
    if len(password) < MIN_LENGTH or types < 3:
        return "weak"
    return "strong" if types == 4 else "medium"


def weak_password_message(password: str) -> str | None:
    """Mensagem explicando o que falta, ou None se a senha é aceita (mediana ou forte)."""
    if len(password) < MIN_LENGTH:
        return f"A senha precisa ter pelo menos {MIN_LENGTH} caracteres"
    if password_strength(password) != "weak":
        return None
    missing = [name for key, name in CHARACTER_TYPES.items() if not character_types(password)[key]]
    return (
        "A senha está fraca: use pelo menos 3 destes tipos: letra minúscula, letra maiúscula, "
        f"número e caractere especial. Falta: {', '.join(missing)}."
    )
