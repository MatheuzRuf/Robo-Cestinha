import uuid

import pytest
from app.db.models import User
from app.domain.sessions.repository import SessionRepository


class FakeResult:
    def __init__(self, users: list[User]) -> None:
        self.users = users

    def scalars(self):
        return self

    def all(self) -> list[User]:
        return self.users


class FakeDatabase:
    def __init__(self, users: list[User]) -> None:
        self.users = users
        self.statement = None

    async def execute(self, statement):
        self.statement = statement
        return FakeResult(self.users)


@pytest.mark.asyncio
async def test_list_users_filters_by_session_and_orders_by_join_sequence():
    session_id = uuid.uuid4()
    users = [
        User(
            id=uuid.uuid4(),
            session_id=session_id,
            join_sequence=1,
            name="Owner",
        )
    ]
    database = FakeDatabase(users)
    repository = SessionRepository(database)

    result = await repository.list_users(session_id)

    assert result == users
    assert "session_id" in str(database.statement._where_criteria[0])
    assert [clause.name for clause in database.statement._order_by_clauses] == [
        "join_sequence"
    ]
