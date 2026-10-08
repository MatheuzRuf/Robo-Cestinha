import re
import uuid
from types import SimpleNamespace

import pytest
from app.api.routers import sessions
from app.api.schemas.session import CreateSessionRequest, JoinSessionRequest
from app.core.ids import generate_session_hash
from app.domain.sessions.service import SessionNotFoundError
from fastapi import HTTPException


def test_generated_session_hash_matches_frontend_code_format():
    assert re.fullmatch(r"#RC-\d{4}-(OAK|TEX|CHI|SEA|BKN|MIA)", generate_session_hash())


@pytest.mark.asyncio
async def test_create_session_returns_frontend_membership_contract():
    session_hash = generate_session_hash()
    owner = SimpleNamespace(id=uuid.uuid4(), name="Alex")

    class MockSessionService:
        async def create_session(self, owner_name: str):
            assert owner_name == "Alex"
            return SimpleNamespace(hash=session_hash), owner

    class MockFactory:
        def session_service(self):
            return MockSessionService()

    response = await sessions.create_session(
        CreateSessionRequest(owner_name="Alex"), MockFactory()
    )

    assert response.session_hash == session_hash
    assert response.owner_user_id == owner.id
    assert response.owner_name == "Alex"
    assert response.team_id is None
    assert response.last_visited_at


@pytest.mark.asyncio
async def test_persisted_session_can_be_found_and_joined():
    session_hash = generate_session_hash()
    user = SimpleNamespace(id=uuid.uuid4(), name="Alex")

    class MockSessionService:
        async def get_session(self, code: str):
            assert code == session_hash
            return SimpleNamespace(hash=session_hash)

        async def join_session(self, code: str, user_name: str):
            assert code == session_hash
            assert user_name == "Alex"
            return SimpleNamespace(hash=session_hash), user

    class MockFactory:
        def session_service(self):
            return MockSessionService()

    descriptor = await sessions.get_session(session_hash, MockFactory())
    membership = await sessions.join_session(
        session_hash, JoinSessionRequest(user_name="Alex"), MockFactory()
    )

    assert descriptor.session_hash == session_hash
    assert membership.session_hash == session_hash
    assert membership.user_id == user.id
    assert membership.user_name == "Alex"
    assert membership.team_id is None
    assert membership.last_visited_at


@pytest.mark.asyncio
async def test_unknown_session_returns_not_found():
    class MockSessionService:
        async def get_session(self, _session_hash: str):
            raise SessionNotFoundError

        async def join_session(self, _session_hash: str, _user_name: str):
            raise SessionNotFoundError

    class MockFactory:
        def session_service(self):
            return MockSessionService()

    with pytest.raises(HTTPException) as error:
        await sessions.get_session("#RC-1234-XYZ", MockFactory())

    assert error.value.status_code == 404
    assert error.value.detail == "session_not_found"

    with pytest.raises(HTTPException) as error:
        await sessions.join_session(
            "#RC-1234-XYZ", JoinSessionRequest(user_name="Alex"), MockFactory()
        )

    assert error.value.status_code == 404
    assert error.value.detail == "session_not_found"
