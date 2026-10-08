import uuid
from types import SimpleNamespace

import pytest
from app.db.models import Session, User
from app.domain.sessions.service import SessionNotFoundError, SessionService


class FakeSessionRepository:
    def __init__(self) -> None:
        self.sessions: list[Session] = []
        self.users: list[User] = []
        self.commits = 0
        self.locked_session_lookup = False

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


@pytest.mark.asyncio
async def test_create_and_join_persist_users_with_scoped_join_sequences():
    repository = FakeSessionRepository()
    service = SessionService(repository, SimpleNamespace())

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
async def test_joining_unknown_session_raises_domain_error():
    service = SessionService(FakeSessionRepository(), SimpleNamespace())

    with pytest.raises(SessionNotFoundError):
        await service.join_session("#RC-1234-XYZ", "Alex")
