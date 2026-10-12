import uuid

import pytest
from app.db.models import Match
from app.domain.bracket.repository import BracketRepository


class FakeDatabase:
    def __init__(self) -> None:
        self.pending: list[Match] = []
        self.persisted_ids: set[uuid.UUID] = set()
        self.flushed_rounds: list[int] = []

    def add_all(self, matches: list[Match]) -> None:
        self.pending.extend(matches)

    async def flush(self) -> None:
        rounds = {match.round for match in self.pending}
        assert len(rounds) == 1
        round_number = rounds.pop()

        for match in self.pending:
            if match.next_match_id is not None:
                assert match.next_match_id in self.persisted_ids
            self.persisted_ids.add(match.id)

        self.pending.clear()
        self.flushed_rounds.append(round_number)


def make_match(
    session_id: uuid.UUID,
    round_number: int,
    slot: int,
    next_match_id: uuid.UUID | None = None,
) -> Match:
    return Match(
        id=uuid.uuid4(),
        session_id=session_id,
        round=round_number,
        slot_in_round=slot,
        next_match_id=next_match_id,
        status="locked",
    )


@pytest.mark.asyncio
async def test_add_matches_flushes_each_round_after_its_next_round():
    session_id = uuid.uuid4()
    final = make_match(session_id, round_number=2, slot=0)
    semifinals = [
        make_match(session_id, round_number=1, slot=slot, next_match_id=final.id)
        for slot in range(2)
    ]
    quarterfinals = [
        make_match(
            session_id,
            round_number=0,
            slot=slot,
            next_match_id=semifinals[slot // 2].id,
        )
        for slot in range(4)
    ]
    database = FakeDatabase()
    repository = BracketRepository(database)

    await repository.add_matches([*quarterfinals, *semifinals, final])

    assert database.flushed_rounds == [2, 1, 0]
    assert len(database.persisted_ids) == 7
