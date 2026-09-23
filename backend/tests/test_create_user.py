import pytest

from app.create_user import CreateUserError, create_user_and_claim_orphans
from app.models.category import Category
from app.models.statement import Statement
from app.services.security import verify_password


def test_cria_usuario_e_atribui_dados_sem_dono(db_session, user):
    # Dados de antes da autenticação (sem dono) e um extrato que já é da Ana
    db_session.add_all(
        [
            Statement(filename="antigo.csv"),
            Category(name="Mercado"),
            Statement(filename="da-ana.csv", user_id=user.id),
        ]
    )
    db_session.commit()

    new_user, statements, categories = create_user_and_claim_orphans(
        db_session, " Eu@Teste.com ", "senha-forte-123"
    )

    assert new_user.email == "eu@teste.com"
    assert verify_password("senha-forte-123", new_user.hashed_password)
    assert (statements, categories) == (1, 1)
    owners = {s.filename: s.user_id for s in db_session.query(Statement)}
    assert owners == {"antigo.csv": new_user.id, "da-ana.csv": user.id}


def test_nao_cria_usuario_com_email_repetido(db_session, user):
    with pytest.raises(CreateUserError, match="Já existe"):
        create_user_and_claim_orphans(db_session, "ana@teste.com", "senha-forte-123")


def test_nao_cria_usuario_com_senha_curta(db_session):
    with pytest.raises(CreateUserError, match="pelo menos 8 caracteres"):
        create_user_and_claim_orphans(db_session, "eu@teste.com", "curta")
