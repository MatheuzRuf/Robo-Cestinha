import uuid
from types import SimpleNamespace

import pytest
from app.db.models import Match
from app.domain.bracket.service import (
    BracketAlreadyGeneratedError,
    BracketOwnerRequiredError,
    BracketService,
)
from app.domain.sessions.service import SessionNotFoundError


class FakeBracketRepository:
    def __init__(self) -> None:
        self.session_id = uuid.uuid4()
        self.owner_id = uuid.uuid4()
        self.session = SimpleNamespace(id=self.session_id, owner_id=self.owner_id)
        self.teams = [
            SimpleNamespace(
                id=uuid.uuid4(),
                name=f"Team {index}",
                abbreviation=f"T{index}",
                nba_team_id=1610612737 + index,
            )
            for index in range(8)
        ]
        self.team_ids = [team.id for team in self.teams]
        self.teams_by_id = {team.id: team for team in self.teams}
        self.matches: list[Match] = []
        self.commits = 0

    async def list_matches(self, _session_id: uuid.UUID):
        return [
            (
                match,
                self.teams_by_id.get(match.home_team_id),
                self.teams_by_id.get(match.away_team_id),
            )
            for match in sorted(
                self.matches, key=lambda item: (item.round, item.slot_in_round)
            )
        ]

    async def list_team_ids(self):
        return self.team_ids

    async def add_matches(self, matches: list[Match]) -> None:
        self.matches.extend(matches)

    async def commit(self) -> None:
        self.commits += 1


class FakeSessionService:
    def __init__(self, repository: FakeBracketRepository) -> None:
        self._repository = repository

    async def get_session(self, _session_hash: str):
        return self._repository.session


def make_bracket_service(repository: FakeBracketRepository) -> BracketService:
    return BracketService(repository, FakeSessionService(repository))


@pytest.mark.asyncio
async def test_get_bracket_returns_empty_skeleton_and_owner_can_generate():
    repository = FakeBracketRepository()
    service = make_bracket_service(repository)

    owner_bracket = await service.get_bracket("#RC-1234-CHI", repository.owner_id)
    other_bracket = await service.get_bracket("#RC-1234-CHI", uuid.uuid4())

    assert owner_bracket["generated"] is False
    assert owner_bracket["can_generate"] is True
    assert other_bracket["can_generate"] is False
    assert [len(round_data["matches"]) for round_data in owner_bracket["rounds"]] == [
        4,
        2,
        1,
    ]


@pytest.mark.asyncio
async def test_owner_generation_persists_one_complete_bracket():
    repository = FakeBracketRepository()
    service = make_bracket_service(repository)

    bracket = await service.generate_bracket("#RC-1234-CHI", repository.owner_id)

    assert bracket["generated"] is True
    assert bracket["can_generate"] is False
    assert [len(round_data["matches"]) for round_data in bracket["rounds"]] == [
        4,
        2,
        1,
    ]
    assert all(
        match["home_team"] is not None and match["away_team"] is not None
        for match in bracket["rounds"][0]["matches"]
    )
    assert all(
        match["home_team"]["nba_team_id"] is not None
        and match["away_team"]["nba_team_id"] is not None
        for match in bracket["rounds"][0]["matches"]
    )
    assert repository.commits == 1

    with pytest.raises(BracketAlreadyGeneratedError):
        await service.generate_bracket("#RC-1234-CHI", repository.owner_id)


@pytest.mark.asyncio
async def test_non_owner_cannot_generate_bracket():
    repository = FakeBracketRepository()
    service = make_bracket_service(repository)

    with pytest.raises(BracketOwnerRequiredError):
        await service.generate_bracket("#RC-1234-CHI", uuid.uuid4())


@pytest.mark.asyncio
async def test_bracket_service_propagates_missing_session_from_session_service():
    repository = FakeBracketRepository()

    class MissingSessionService:
        async def get_session(self, _session_hash: str):
            raise SessionNotFoundError

    service = BracketService(repository, MissingSessionService())

    with pytest.raises(SessionNotFoundError):
        await service.get_bracket("#RC-1234-CHI", repository.owner_id)
