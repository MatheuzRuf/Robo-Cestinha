import uuid
from dataclasses import replace
from types import SimpleNamespace

import pytest
from app.domain.sessions.service import SessionNotFoundError
from app.domain.teams.errors import (
    AlreadyClaimedError,
    BracketNotGeneratedError,
    ParticipantNotFoundError,
    TeamClaimConflictError,
    TeamNotFoundError,
    TeamUnavailableError,
)
from app.domain.teams.service import TeamLockerService
from app.domain.teams.types import TeamLockerContext


def make_team(name: str = "Celtics"):
    return SimpleNamespace(
        id=uuid.uuid4(),
        name=name,
        abbreviation="BOS",
        nba_team_id=1610612738,
        season="2025-26",
        team_stats={"pace": 99.0, "off_rtg": 117.0, "def_rtg": 109.0},
    )


def make_player(team_id: uuid.UUID):
    return SimpleNamespace(
        id=uuid.uuid4(),
        team_id=team_id,
        nba_player_id=2544,
        name="Player One",
        position="G",
        position5="PG",
        is_starter=True,
        attributes={
            "two_pt_pct": 0.5,
            "three_pt_pct": 0.4,
            "ft_pct": 0.8,
            "turnover_rate": 0.1,
            "foul_rate": 0.05,
            "rebound_rate": 0.2,
            "assist_rate": 0.3,
            "steal_rate": 0.04,
            "block_rate": 0.03,
            "stamina": 0.9,
            "clutch_factor": 0.7,
            "usage_rate": 0.25,
        },
    )


class FakeSessionService:
    def __init__(self, session=None, error=None) -> None:
        self.session = session or SimpleNamespace(id=uuid.uuid4(), hash="#RC-1234-OAK")
        self.error = error

    async def get_session(self, _session_hash: str):
        if self.error:
            raise self.error
        return self.session


class FakeTeamRepository:
    def __init__(self, context: TeamLockerContext) -> None:
        self.context = context
        self.claimed: tuple[uuid.UUID, uuid.UUID, uuid.UUID] | None = None
        self.claim_error: Exception | None = None

    async def get_locker_context(self, _session_id: uuid.UUID, _user_id: uuid.UUID):
        return self.context

    async def claim_team(
        self, session_id: uuid.UUID, user_id: uuid.UUID, team_id: uuid.UUID
    ):
        if self.claim_error:
            raise self.claim_error
        self.claimed = session_id, user_id, team_id
        self.context.participant.team_id = team_id
        self.context.team_claims[team_id] = user_id


def make_context(
    *,
    participant_id: uuid.UUID | None = None,
    participant_team_id: uuid.UUID | None = None,
    bracket_generated: bool = True,
):
    participant_id = participant_id or uuid.uuid4()
    first_team = make_team()
    second_team = make_team("Lakers")
    participant = SimpleNamespace(id=participant_id, team_id=participant_team_id)
    return (
        TeamLockerContext(
            participant=participant,
            teams=[first_team, second_team],
            players_by_team={first_team.id: [make_player(first_team.id)]},
            team_claims={},
            eliminated_team_ids=set(),
            bracket_generated=bracket_generated,
        ),
        first_team,
        second_team,
    )


def make_service(context: TeamLockerContext):
    repository = FakeTeamRepository(context)
    session_service = FakeSessionService()
    return TeamLockerService(repository, session_service), repository, session_service


@pytest.mark.asyncio
async def test_get_locker_maps_persisted_roster_claims_and_statistics():
    context, first_team, second_team = make_context()
    other_user_id = uuid.uuid4()
    context.team_claims[first_team.id] = other_user_id
    context.eliminated_team_ids.add(second_team.id)
    service, _, _ = make_service(context)

    snapshot = await service.get_locker("#RC-1234-OAK", context.participant.id)

    assert snapshot.session_hash == "#RC-1234-OAK"
    assert snapshot.my_team_id is None
    assert snapshot.open_team_count == 0
    assert snapshot.total_team_count == 2
    assert [team.claim_status for team in snapshot.teams] == [
        "locked_by_other",
        "locked_by_other",
    ]
    assert snapshot.teams[0].season == "2025-26"
    assert snapshot.teams[0].statistics == {
        "pace": 99.0,
        "offensive_rating": 117.0,
        "defensive_rating": 109.0,
    }
    assert snapshot.teams[0].players[0].attributes["two_point_pct"] == 0.5


@pytest.mark.asyncio
async def test_claim_team_persists_selection_and_returns_updated_snapshot():
    context, first_team, _ = make_context()
    service, repository, session_service = make_service(context)

    snapshot = await service.claim_team(
        "#RC-1234-OAK", context.participant.id, first_team.id
    )

    assert repository.claimed == (
        session_service.session.id,
        context.participant.id,
        first_team.id,
    )
    assert snapshot.my_team_id == first_team.id
    assert snapshot.teams[0].claim_status == "locked_by_you"
    assert snapshot.open_team_count == 1


@pytest.mark.asyncio
async def test_claim_team_rejects_participant_with_existing_selection():
    existing_team_id = uuid.uuid4()
    context, first_team, _ = make_context(participant_team_id=existing_team_id)
    service, _, _ = make_service(context)

    with pytest.raises(AlreadyClaimedError):
        await service.claim_team("#RC-1234-OAK", context.participant.id, first_team.id)


@pytest.mark.asyncio
async def test_claim_team_rejects_team_outside_the_session_bracket():
    context, _, _ = make_context()
    service, _, _ = make_service(context)

    with pytest.raises(TeamNotFoundError):
        await service.claim_team("#RC-1234-OAK", context.participant.id, uuid.uuid4())


@pytest.mark.asyncio
@pytest.mark.parametrize("unavailable_reason", ["claimed", "eliminated"])
async def test_claim_team_rejects_claimed_or_eliminated_team(unavailable_reason):
    context, first_team, _ = make_context()
    if unavailable_reason == "claimed":
        context.team_claims[first_team.id] = uuid.uuid4()
    else:
        context.eliminated_team_ids.add(first_team.id)
    service, _, _ = make_service(context)

    with pytest.raises(TeamUnavailableError):
        await service.claim_team("#RC-1234-OAK", context.participant.id, first_team.id)


@pytest.mark.asyncio
async def test_claim_team_maps_concurrent_database_conflict_to_unavailable():
    context, first_team, _ = make_context()
    service, repository, _ = make_service(context)
    repository.claim_error = TeamClaimConflictError(first_team.id)

    with pytest.raises(TeamUnavailableError):
        await service.claim_team("#RC-1234-OAK", context.participant.id, first_team.id)


@pytest.mark.asyncio
async def test_team_locker_requires_participant_and_generated_bracket():
    context, _, _ = make_context()
    context = replace(context, participant=None)
    service, _, _ = make_service(context)

    with pytest.raises(ParticipantNotFoundError):
        await service.get_locker("#RC-1234-OAK", uuid.uuid4())

    context, _, _ = make_context(bracket_generated=False)
    service, _, _ = make_service(context)
    with pytest.raises(BracketNotGeneratedError):
        await service.get_locker("#RC-1234-OAK", context.participant.id)


@pytest.mark.asyncio
async def test_team_locker_propagates_unknown_session():
    context, _, _ = make_context()
    repository = FakeTeamRepository(context)
    service = TeamLockerService(
        repository, FakeSessionService(error=SessionNotFoundError)
    )

    with pytest.raises(SessionNotFoundError):
        await service.get_locker("#RC-1234-XYZ", context.participant.id)
