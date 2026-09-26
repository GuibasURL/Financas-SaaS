from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.services.security import decode_access_token

# tokenUrl faz o botão "Authorize" do Swagger (/docs) funcionar
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    """Dependency das rotas protegidas: devolve o usuário dono do token ou 401."""
    access = decode_access_token(token)
    user = db.get(User, access.user_id) if access else None
    # Token emitido antes da última troca de senha: a sessão de outro aparelho
    # (ou de quem descobriu a senha antiga) cai junto com a senha
    if user and not user.token_is_current(access.issued_at):
        user = None
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
