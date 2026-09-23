import unicodedata


def strip_accents(text: str) -> str:
    """'Farmácia São João' -> 'Farmacia Sao Joao'"""
    return "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )


def normalize_text(text: str) -> str:
    """Forma usada para comparar textos: sem acentos e em minúsculas."""
    return strip_accents(text).lower()
