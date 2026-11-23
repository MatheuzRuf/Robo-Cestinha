import uuid
from types import SimpleNamespace

import pytest
from app.api.routers import teams
from app.api.schemas.team import TeamClaimRequest
from app.domain.sessions.service import SessionNotFoundError
from app.domain.teams.errors import (
    AlreadyClaimedError,
    BracketNotGeneratedError,
    ParticipantNotFoundError,
    TeamNotFoundError,
    TeamUnavailableError,
)
from fastapi import HTTPException

SESSION_HASH = "#RC-1234-OAK"
USER_ID = uuid.uuid4()
TEAM_ID = uuid.uuid4()


def make_snapshot():
    attributes = {
        "two_point_pct": 0.5,
        "three_point_pct": 0.4,
        "free_throw_pct": 0.8,
        "turnover_rate": 0.1,
        "foul_rate": 0.05,
        "rebound_rate": 0.2,
        "assist_rate": 0.3,
        "steal_rate": 0.04,
        "block_rate": 0.03,
        "stamina": 0.9,
        "clutch_factor": 0.7,
        "usage_rate": 0.25,
    }
    player = SimpleNamespace(
        id=uuid.uuid4(),
        nba_player_id=2544,
        name="Player One",
        position="PG",
        position_group="G",
        is_starter=True,
        attributes=attributes,
    )
    team = SimpleNamespace(
        id=TEAM_ID,
        nba_team_id=1610612738,
        name="Boston Celtics",
        abbreviation="BOS",
        season="2025-26",
        statistics={
            "pace": 99.0,
            "offensive_rating": 117.0,
            "defensive_rating": 109.0,
        },
        players=[player],
        claim_status="locked_by_you",
    )
    return SimpleNamespace(
        session_hash=SESSION_HASH,
        teams=[team],
        my_team_id=TEAM_ID,
        open_team_count=0,
        total_team_count=1,
    )


@pytest.mark.asyncio
async def test_get_team_locker_returns_frontend_contract_from_service():
    snapshot = make_snapshot()

    class MockTeamLockerService:
        async def get_locker(self, session_hash: str, user_id: uuid.UUID):
            assert session_hash == SESSION_HASH
            assert user_id == USER_ID
            return snapshot

    class MockFactory:
        def team_locker_service(self):
            return MockTeamLockerService()

    response = await teams.get_team_locker(SESSION_HASH, USER_ID, MockFactory())
    payload = response.model_dump(mode="json", by_alias=True)

    assert payload["sessionHash"] == SESSION_HASH
    assert payload["myTeamId"] == str(TEAM_ID)
    assert payload["openTeamCount"] == 0
    assert payload["totalTeamCount"] == 1
    assert payload["teams"][0]["claimStatus"] == "locked_by_you"
    assert payload["teams"][0]["season"] == "2025-26"
    assert payload["teams"][0]["statistics"]["offensiveRating"] == 117.0
    assert payload["teams"][0]["players"][0]["attributes"]["twoPointPct"] == 0.5


@pytest.mark.asyncio
async def test_claim_team_calls_service_and_returns_refreshed_snapshot():
    snapshot = make_snapshot()

    class MockTeamLockerService:
        async def claim_team(
            self, *, session_hash: str, user_id: uuid.UUID, team_id: uuid.UUID
        ):
            assert session_hash == SESSION_HASH
            assert user_id == USER_ID
            assert team_id == TEAM_ID
            return snapshot

    class MockFactory:
        def team_locker_service(self):
            return MockTeamLockerService()

    response = await teams.claim_team(
        SESSION_HASH,
        TeamClaimRequest(user_id=USER_ID, team_id=TEAM_ID),
        MockFactory(),
    )

    assert response.my_team_id == TEAM_ID
    assert response.teams[0].claim_status == "locked_by_you"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("error", "status_code", "detail"),
    [
        (SessionNotFoundError, 404, "session_not_found"),
        (ParticipantNotFoundError, 404, "participant_not_found"),
        (BracketNotGeneratedError, 409, "bracket_not_generated"),
        (AlreadyClaimedError, 409, "already_claimed"),
        (TeamNotFoundError, 404, "team_not_found"),
        (TeamUnavailableError, 409, "team_unavailable"),
    ],
)
async def test_claim_team_maps_domain_errors(error, status_code, detail):
    class MockTeamLockerService:
        async def claim_team(self, **_kwargs):
            raise error

    class MockFactory:
        def team_locker_service(self):
            return MockTeamLockerService()

    with pytest.raises(HTTPException) as caught:
        await teams.claim_team(
            SESSION_HASH,
            TeamClaimRequest(user_id=USER_ID, team_id=TEAM_ID),
            MockFactory(),
        )

    assert caught.value.status_code == status_code
    assert caught.value.detail == detail
