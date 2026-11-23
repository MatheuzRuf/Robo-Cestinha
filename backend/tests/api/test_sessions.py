import re
import uuid
from types import SimpleNamespace

import pytest
from app.api.routers import sessions
from app.api.schemas.session import CreateSessionRequest, JoinSessionRequest
from app.core.ids import generate_session_hash
from app.domain.sessions.service import (
    SessionNotFoundError,
    SessionOwnerCannotLeaveError,
    SessionOwnerRequiredError,
    SessionParticipantNotFoundError,
)
from fastapi import HTTPException
from pydantic import ValidationError


def test_generated_session_hash_matches_frontend_code_format():
    assert re.fullmatch(r"#RC-\d{4}-(OAK|TEX|CHI|SEA|BKN|MIA)", generate_session_hash())


def test_join_session_name_accepts_issue_and_frontend_fields_after_trimming():
    assert JoinSessionRequest(name="  Jordan  ").user_name == "Jordan"
    assert JoinSessionRequest(user_name=" Alex ").user_name == "Alex"

    with pytest.raises(ValidationError):
        JoinSessionRequest(name="   ")

    with pytest.raises(ValidationError):
        JoinSessionRequest(name="A" * 25)


def test_create_session_name_is_trimmed_and_defaults_for_existing_clients():
    assert CreateSessionRequest(owner_name="Alex").session_name == "Tournament"
    assert (
        CreateSessionRequest(
            owner_name="Alex", session_name="  Summer Cup  "
        ).session_name
        == "Summer Cup"
    )

    with pytest.raises(ValidationError):
        CreateSessionRequest(owner_name="Alex", session_name="   ")


@pytest.mark.asyncio
async def test_create_session_returns_membership_after_bracket_setup():
    session_hash = generate_session_hash()
    owner = SimpleNamespace(id=uuid.uuid4(), name="Alex")

    class MockSessionSetupService:
        async def create_session(self, owner_name: str, session_name: str):
            assert owner_name == "Alex"
            assert session_name == "Tournament"
            return SimpleNamespace(hash=session_hash, name=session_name), owner

    class MockFactory:
        def session_setup_service(self):
            return MockSessionSetupService()

    response = await sessions.create_session(
        CreateSessionRequest(owner_name="Alex"), MockFactory()
    )

    assert response.session_hash == session_hash
    assert response.owner_user_id == owner.id
    assert response.owner_name == "Alex"
    assert response.session_name == "Tournament"
    assert response.team_id is None
    assert response.last_visited_at


@pytest.mark.asyncio
async def test_persisted_session_can_be_found_and_joined():
    session_hash = generate_session_hash()
    user = SimpleNamespace(id=uuid.uuid4(), name="Alex")

    class MockSessionService:
        async def get_session(self, code: str):
            assert code == session_hash
            return SimpleNamespace(
                hash=session_hash,
                name="Tournament",
                owner_id=uuid.uuid4(),
            )

        async def join_session(self, code: str, user_name: str):
            assert code == session_hash
            assert user_name == "Alex"
            return SimpleNamespace(hash=session_hash, name="Tournament"), user

    class MockFactory:
        def session_service(self):
            return MockSessionService()

    descriptor = await sessions.get_session(session_hash, MockFactory())
    membership = await sessions.join_session(
        session_hash, JoinSessionRequest(user_name="Alex"), MockFactory()
    )

    assert descriptor.session_hash == session_hash
    assert descriptor.session_name == "Tournament"
    assert descriptor.owner_user_id is not None
    assert membership.session_hash == session_hash
    assert membership.user_id == user.id
    assert membership.user_name == "Alex"
    assert membership.session_name == "Tournament"
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


@pytest.mark.asyncio
async def test_session_participants_returns_service_results_in_join_order():
    owner_id = uuid.uuid4()
    participant_id = uuid.uuid4()

    class MockSessionService:
        async def list_participants(self, session_hash: str):
            assert session_hash == "#RC-1234-OAK"
            return [
                SimpleNamespace(
                    user_id=owner_id,
                    user_name="Alex Morgan",
                    join_sequence=1,
                    is_owner=True,
                ),
                SimpleNamespace(
                    user_id=participant_id,
                    user_name="Jordan Lee",
                    join_sequence=2,
                    is_owner=False,
                ),
            ]

    class MockFactory:
        def session_service(self):
            return MockSessionService()

    participants = await sessions.get_session_participants(
        "#RC-1234-OAK", MockFactory()
    )

    assert [participant.join_sequence for participant in participants] == [1, 2]
    assert [participant.is_owner for participant in participants] == [True, False]
    assert participants[0].user_id == owner_id
    assert participants[1].user_name == "Jordan Lee"


@pytest.mark.asyncio
async def test_session_participants_maps_unknown_session_to_not_found():
    class MockSessionService:
        async def list_participants(self, _session_hash: str):
            raise SessionNotFoundError

    class MockFactory:
        def session_service(self):
            return MockSessionService()

    with pytest.raises(HTTPException) as error:
        await sessions.get_session_participants("#RC-1234-OAK", MockFactory())

    assert error.value.status_code == 404
    assert error.value.detail == "session_not_found"


@pytest.mark.asyncio
async def test_delete_and_leave_routes_delegate_to_session_service():
    user_id = uuid.uuid4()

    class MockSessionService:
        async def delete_session(self, session_hash: str, requester_id: uuid.UUID):
            assert session_hash == "#RC-1234-OAK"
            assert requester_id == user_id

        async def leave_session(self, session_hash: str, participant_id: uuid.UUID):
            assert session_hash == "#RC-1234-OAK"
            assert participant_id == user_id

    class MockFactory:
        def session_service(self):
            return MockSessionService()

    deleted = await sessions.delete_session("#RC-1234-OAK", user_id, MockFactory())
    left = await sessions.leave_session("#RC-1234-OAK", user_id, MockFactory())

    assert deleted.status_code == 204
    assert left.status_code == 204


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("error", "status_code", "detail"),
    [
        (SessionNotFoundError, 404, "session_not_found"),
        (SessionOwnerRequiredError, 403, "session_owner_required"),
    ],
)
async def test_delete_session_maps_domain_errors(error, status_code, detail):
    class MockSessionService:
        async def delete_session(self, _session_hash: str, _user_id: uuid.UUID):
            raise error

    class MockFactory:
        def session_service(self):
            return MockSessionService()

    with pytest.raises(HTTPException) as caught:
        await sessions.delete_session("#RC-1234-OAK", uuid.uuid4(), MockFactory())

    assert caught.value.status_code == status_code
    assert caught.value.detail == detail


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("error", "status_code", "detail"),
    [
        (SessionNotFoundError, 404, "session_not_found"),
        (SessionParticipantNotFoundError, 404, "participant_not_found"),
        (SessionOwnerCannotLeaveError, 409, "owner_cannot_leave"),
    ],
)
async def test_leave_session_maps_domain_errors(error, status_code, detail):
    class MockSessionService:
        async def leave_session(self, _session_hash: str, _user_id: uuid.UUID):
            raise error

    class MockFactory:
        def session_service(self):
            return MockSessionService()

    with pytest.raises(HTTPException) as caught:
        await sessions.leave_session("#RC-1234-OAK", uuid.uuid4(), MockFactory())

    assert caught.value.status_code == status_code
    assert caught.value.detail == detail
