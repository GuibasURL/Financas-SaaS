import re
import unicodedata


def strip_accents(text: str) -> str:
    """'Farmácia São João' -> 'Farmacia Sao Joao'"""
    return "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )


def normalize_text(text: str) -> str:
    """Forma usada para comparar textos: sem acentos e em minúsculas."""
    return strip_accents(text).lower()


def normalize_for_matching(text: str) -> str:
    """
    Forma usada pelas regras de categorização: sem acentos, minúsculo, só
    letras/números separados por um espaço, e letra colada em número separada.

        "UBER *EATS"       -> "uber eats"
        "NETFLIX.COM"      -> "netflix com"
        "DROGASIL1234"     -> "drogasil 1234"
        "99APP *99POP"     -> "99 app 99 pop"
    """
    text = normalize_text(text)
    text = re.sub(r"(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])", " ", text)
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text).split())
