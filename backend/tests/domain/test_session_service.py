import uuid

import pytest
from app.db.models import Session, User
from app.domain.sessions.service import (
    SessionNotFoundError,
    SessionOwnerCannotLeaveError,
    SessionOwnerRequiredError,
    SessionParticipantNotFoundError,
    SessionService,
)


class FakeSessionRepository:
    def __init__(self) -> None:
        self.sessions: list[Session] = []
        self.users: list[User] = []
        self.commits = 0
        self.locked_session_lookup = False
        self.deleted_session_ids: list[uuid.UUID] = []

    async def add_session(self, session: Session) -> None:
        self.sessions.append(session)

    async def add_user(self, user: User) -> None:
        self.users.append(user)

    async def commit(self) -> None:
        self.commits += 1

    async def refresh(self, _entity: object) -> None:
        return None

    async def get_session_by_hash(
        self, session_hash: str, *, for_update: bool = False
    ) -> Session | None:
        self.locked_session_lookup = for_update
        normalized_hash = session_hash.strip().upper().removeprefix("#")
        return next(
            (
                session
                for session in self.sessions
                if session.hash.upper().removeprefix("#") == normalized_hash
            ),
            None,
        )

    async def next_join_sequence(self, session_id: uuid.UUID) -> int:
        existing = [
            user.join_sequence for user in self.users if user.session_id == session_id
        ]
        return max(existing, default=0) + 1

    async def list_users(self, session_id: uuid.UUID) -> list[User]:
        return sorted(
            (user for user in self.users if user.session_id == session_id),
            key=lambda user: user.join_sequence,
        )

    async def get_user(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        *,
        for_update: bool = False,
    ) -> User | None:
        return next(
            (
                user
                for user in self.users
                if user.session_id == session_id and user.id == user_id
            ),
            None,
        )

    async def delete_participant(self, user: User) -> None:
        self.users.remove(user)

    async def delete_session_records(self, session_id: uuid.UUID) -> None:
        self.deleted_session_ids.append(session_id)
        self.sessions = [
            session for session in self.sessions if session.id != session_id
        ]
        self.users = [user for user in self.users if user.session_id != session_id]


@pytest.mark.asyncio
async def test_create_and_join_persist_users_with_scoped_join_sequences():
    repository = FakeSessionRepository()
    service = SessionService(repository)

    session, owner = await service.create_session("Alex")
    joined_session, participant = await service.join_session(
        session.hash.removeprefix("#").lower(), "Sam"
    )

    assert session.hash.startswith("#RC-")
    assert owner.session_id == session.id
    assert owner.join_sequence == 1
    assert joined_session.id == session.id
    assert participant.join_sequence == 2
    assert participant.name == "Sam"
    assert repository.locked_session_lookup
    assert repository.commits == 2


@pytest.mark.asyncio
async def test_create_session_can_leave_commit_to_setup_workflow():
    repository = FakeSessionRepository()
    service = SessionService(repository)

    session, owner = await service.create_session("Alex", "Spring Cup", commit=False)

    assert session.owner_id == owner.id
    assert session.name == "Spring Cup"
    assert repository.commits == 0


@pytest.mark.asyncio
async def test_joining_unknown_session_raises_domain_error():
    service = SessionService(FakeSessionRepository())

    with pytest.raises(SessionNotFoundError):
        await service.join_session("#RC-1234-XYZ", "Alex")


@pytest.mark.asyncio
async def test_list_participants_returns_persisted_users_and_owner_flag():
    repository = FakeSessionRepository()
    service = SessionService(repository)
    session, owner = await service.create_session("Alex")
    await service.join_session(session.hash, "Sam")

    participants = await service.list_participants(session.hash)

    assert [participant.join_sequence for participant in participants] == [1, 2]
    assert [participant.user_name for participant in participants] == ["Alex", "Sam"]
    assert [participant.is_owner for participant in participants] == [True, False]
    assert participants[0].user_id == owner.id


@pytest.mark.asyncio
async def test_list_participants_raises_for_unknown_session():
    service = SessionService(FakeSessionRepository())

    with pytest.raises(SessionNotFoundError):
        await service.list_participants("#RC-1234-XYZ")


@pytest.mark.asyncio
async def test_non_owner_can_leave_and_release_their_team_claim():
    repository = FakeSessionRepository()
    service = SessionService(repository)
    session, owner = await service.create_session("Owner")
    _, participant = await service.join_session(session.hash, "Guest")
    participant.team_id = uuid.uuid4()

    await service.leave_session(session.hash, participant.id)

    assert await repository.get_user(session.id, participant.id) is None
    assert await repository.get_user(session.id, owner.id) is owner
    assert repository.commits == 3


@pytest.mark.asyncio
async def test_owner_cannot_leave_and_non_participant_cannot_leave():
    repository = FakeSessionRepository()
    service = SessionService(repository)
    session, owner = await service.create_session("Owner")

    with pytest.raises(SessionOwnerCannotLeaveError):
        await service.leave_session(session.hash, owner.id)

    with pytest.raises(SessionParticipantNotFoundError):
        await service.leave_session(session.hash, uuid.uuid4())

    assert repository.commits == 1


@pytest.mark.asyncio
async def test_only_owner_can_delete_session_data():
    repository = FakeSessionRepository()
    service = SessionService(repository)
    session, owner = await service.create_session("Owner")

    with pytest.raises(SessionOwnerRequiredError):
        await service.delete_session(session.hash, uuid.uuid4())

    await service.delete_session(session.hash, owner.id)

    assert repository.deleted_session_ids == [session.id]
    assert repository.sessions == []
    assert repository.users == []
    assert repository.commits == 2
