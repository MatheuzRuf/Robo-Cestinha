import re
import uuid
from types import SimpleNamespace

import pytest
from app.api.routers import sessions
from app.api.schemas.session import (
    CreateSessionRequest,
    JoinSessionRequest,
    SessionSettingsPayload,
    TeamClaimRequest,
)
from app.core.ids import generate_session_hash
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

    settings = SessionSettingsPayload(
        sim_speed="blitz", quarter_length="5", auto_fill=False
    )
    try:
        response = await sessions.create_session(
            CreateSessionRequest(owner_name="Alex", settings=settings), MockFactory()
        )

        assert response.session_hash == session_hash
        assert response.owner_user_id == owner.id
        assert response.owner_name == "Alex"
        assert response.settings == settings
    finally:
        sessions.MOCK_SESSION_DESCRIPTORS.pop(session_hash, None)
        sessions.MOCK_SESSION_SETTINGS.pop(session_hash, None)


@pytest.mark.asyncio
async def test_featured_session_codes_are_returned():
    response = await sessions.get_featured_sessions()

    assert response.session_hashes == ["#RC-7842-OAK", "#RC-9104-TEX"]


@pytest.mark.asyncio
async def test_featured_session_can_be_found_and_joined():
    descriptor = await sessions.get_session("#RC-7842-OAK")
    membership = await sessions.join_session(
        "#RC-7842-OAK", JoinSessionRequest(user_name="Alex")
    )

    assert descriptor.session_hash == "#RC-7842-OAK"
    assert membership.session_hash == "#RC-7842-OAK"
    assert membership.user_name == "Alex"
    assert membership.team_id is None


@pytest.mark.asyncio
async def test_unknown_session_returns_not_found():
    with pytest.raises(HTTPException) as error:
        await sessions.get_session("#RC-1234-XYZ")

    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_team_locker_claim_rejects_duplicate_claims():
    session_hash = "#RC-TEST-CLAIM"
    sessions.MOCK_SESSION_TEAM_CLAIMS.pop(session_hash, None)

    try:
        snapshot = await sessions.get_team_locker(session_hash, user_id="user-one")
        assert snapshot["totalTeamCount"] == 8
        assert snapshot["openTeamCount"] == 8

        updated = await sessions.claim_team(
            session_hash,
            TeamClaimRequest(user_id="user-one", team_id=snapshot["teams"][0]["id"]),
        )
        assert updated["myTeamId"] == snapshot["teams"][0]["id"]

        with pytest.raises(HTTPException) as error:
            await sessions.claim_team(
                session_hash,
                TeamClaimRequest(
                    user_id="user-two", team_id=snapshot["teams"][0]["id"]
                ),
            )

        assert error.value.status_code == 409
        assert error.value.detail == "team_unavailable"
    finally:
        sessions.MOCK_SESSION_TEAM_CLAIMS.pop(session_hash, None)
