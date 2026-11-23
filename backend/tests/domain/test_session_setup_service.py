import uuid
from types import SimpleNamespace

import pytest
from app.domain.sessions.setup_service import SessionSetupService


@pytest.mark.asyncio
async def test_session_setup_creates_bracket_before_returning_membership():
    session = SimpleNamespace(id=uuid.uuid4(), hash="#RC-1234-OAK")
    owner = SimpleNamespace(id=uuid.uuid4())

    class FakeSessionService:
        async def create_session(
            self,
            owner_name: str,
            session_name: str,
            *,
            commit: bool,
        ):
            assert owner_name == "Jordan"
            assert session_name == "Summer Cup"
            assert commit is False
            return session, owner

    class FakeBracketService:
        async def generate_bracket(self, session_hash: str, owner_id: uuid.UUID):
            assert session_hash == session.hash
            assert owner_id == owner.id

    service = SessionSetupService(FakeSessionService(), FakeBracketService())

    created_session, created_owner = await service.create_session(
        "Jordan", "Summer Cup"
    )

    assert created_session is session
    assert created_owner is owner
