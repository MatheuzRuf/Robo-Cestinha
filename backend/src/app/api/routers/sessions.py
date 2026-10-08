import json
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.factories import ServiceFactory
from app.api.schemas.session import (
    CreateSessionRequest,
    CreateSessionResponse,
    FeaturedSessionsResponse,
    JoinSessionRequest,
    SessionDescriptorResponse,
    SessionMembershipResponse,
    SessionSettingsPayload,
    TeamClaimRequest,
)

router = APIRouter()

MOCK_FEATURED_SESSION_CODES = ("#RC-7842-OAK", "#RC-9104-TEX")
MOCK_SESSION_DESCRIPTORS: dict[str, dict[str, str | None]] = {
    code: {"session_hash": code, "session_name": None}
    for code in MOCK_FEATURED_SESSION_CODES
}
MOCK_SESSION_SETTINGS: dict[str, SessionSettingsPayload] = {
    code: SessionSettingsPayload() for code in MOCK_FEATURED_SESSION_CODES
}
MOCK_SESSION_TEAM_CLAIMS: dict[str, dict[str, str]] = {}
MOCK_SESSION_TEAM_IDS = ("bkn", "nyk", "bos", "gsw", "okc", "lal", "den", "phi")
PROCESSED_DATA_DIR = Path(__file__).resolve().parents[5] / "data" / "processed"


def _load_mock_teams() -> list[dict[str, Any]]:
    players_data = json.loads((PROCESSED_DATA_DIR / "players.json").read_text())
    teams_data = json.loads((PROCESSED_DATA_DIR / "teams.json").read_text())
    players_by_id = {player["player_id"]: player for player in players_data}
    teams: list[dict[str, Any]] = []

    for team_id in MOCK_SESSION_TEAM_IDS:
        catalog_team = next(
            (team for team in teams_data if team["team_id"] == team_id), None
        )
        if catalog_team is None:
            continue

        players = []
        for player_id in catalog_team["roster"]:
            player = players_by_id.get(player_id)
            if player is None:
                continue
            attributes = player["attributes"]
            players.append(
                {
                    "id": player["player_id"],
                    "name": player["name"],
                    "position": player["position5"],
                    "positionGroup": player["position"],
                    "isStarter": player["is_starter"],
                    "attributes": {
                        "twoPointPct": attributes["two_pt_pct"],
                        "threePointPct": attributes["three_pt_pct"],
                        "freeThrowPct": attributes["ft_pct"],
                        "turnoverRate": attributes["turnover_rate"],
                        "foulRate": attributes["foul_rate"],
                        "reboundRate": attributes["rebound_rate"],
                        "assistRate": attributes["assist_rate"],
                        "stealRate": attributes["steal_rate"],
                        "blockRate": attributes["block_rate"],
                        "stamina": attributes["stamina"],
                        "clutchFactor": attributes["clutch_factor"],
                        "usageRate": attributes["usage_rate"],
                    },
                }
            )

        stats = catalog_team["team_stats"]
        teams.append(
            {
                "id": catalog_team["team_id"],
                "name": catalog_team["name"],
                "abbreviation": catalog_team["abbreviation"],
                "season": catalog_team["season"],
                "statistics": {
                    "pace": stats["pace"],
                    "offensiveRating": stats["off_rtg"],
                    "defensiveRating": stats["def_rtg"],
                },
                "players": players,
            }
        )

    return teams


MOCK_TEAMS = _load_mock_teams()


def _make_team_locker_snapshot(session_hash: str, user_id: str) -> dict[str, Any]:
    session_claims = MOCK_SESSION_TEAM_CLAIMS.get(session_hash, {})
    my_team_id = session_claims.get(user_id)
    team_owners = {team_id: owner_id for owner_id, team_id in session_claims.items()}
    teams = []

    for team in MOCK_TEAMS:
        owner_id = team_owners.get(team["id"])
        claim_status = (
            "available"
            if owner_id is None
            else "locked_by_you"
            if owner_id == user_id
            else "locked_by_other"
        )
        teams.append(
            {
                **team,
                "players": [
                    {
                        **player,
                        "attributes": dict(player["attributes"]),
                    }
                    for player in team["players"]
                ],
                "claimStatus": claim_status,
            }
        )

    return {
        "sessionHash": session_hash,
        "teams": teams,
        "myTeamId": my_team_id,
        "openTeamCount": sum(team["claimStatus"] == "available" for team in teams),
        "totalTeamCount": len(teams),
    }


@router.post("", response_model=CreateSessionResponse)
async def create_session(
    payload: CreateSessionRequest,
    factory: Annotated[ServiceFactory, Depends()],
) -> CreateSessionResponse:
    # TODO: Persist the selected simulation settings alongside the session.
    """Create a session and its owner using the existing database service.

    Args:
        payload: Owner name and selected simulation settings.
        factory: Factory for request-scoped application services.

    Returns:
        Session and owner details in the frontend membership contract.
    """

    service = factory.session_service()
    session, owner = await service.create_session(owner_name=payload.owner_name)
    now = datetime.now(UTC).isoformat()
    MOCK_SESSION_DESCRIPTORS[session.hash] = {
        "session_hash": session.hash,
        "session_name": None,
    }
    MOCK_SESSION_SETTINGS[session.hash] = payload.settings
    return CreateSessionResponse(
        session_hash=session.hash,
        owner_user_id=owner.id,
        owner_name=owner.name,
        team_id=None,
        last_visited_at=now,
        settings=payload.settings,
    )


@router.get("/featured", response_model=FeaturedSessionsResponse)
async def get_featured_sessions() -> FeaturedSessionsResponse:
    # TODO: Return featured sessions that exist in the persisted session store.
    """Return demo session codes for the home page.

    Returns:
        The list of temporarily featured session codes.
    """

    return FeaturedSessionsResponse(session_hashes=list(MOCK_FEATURED_SESSION_CODES))


@router.get("/{session_hash}", response_model=SessionDescriptorResponse)
async def get_session(session_hash: str) -> SessionDescriptorResponse:
    # TODO: Replace this in-memory lookup with a database session query.
    """Look up a session by its public code.

    Args:
        session_hash: Public session code to find.

    Returns:
        The public session descriptor.

    Raises:
        HTTPException: If no matching session exists.
    """

    descriptor = MOCK_SESSION_DESCRIPTORS.get(session_hash.upper())
    if descriptor is None:
        raise HTTPException(status_code=404, detail="session_not_found")
    return SessionDescriptorResponse(**descriptor)


@router.post("/{session_hash}/join", response_model=SessionMembershipResponse)
async def join_session(
    session_hash: str,
    payload: JoinSessionRequest,
) -> SessionMembershipResponse:
    # TODO: Persist the participant and assign a session-scoped join sequence.
    """Temporarily create a participant membership for a known session.

    Args:
        session_hash: Public session code to join.
        payload: Participant display name.

    Returns:
        A temporary session membership.

    Raises:
        HTTPException: If no matching session exists.
    """

    descriptor = MOCK_SESSION_DESCRIPTORS.get(session_hash.upper())
    if descriptor is None:
        raise HTTPException(status_code=404, detail="session_not_found")

    return SessionMembershipResponse(
        session_hash=descriptor["session_hash"] or session_hash,
        user_id=uuid.uuid4(),
        user_name=payload.user_name,
        team_id=None,
        last_visited_at=datetime.now(UTC).isoformat(),
        settings=MOCK_SESSION_SETTINGS.get(session_hash.upper()),
    )


@router.get("/{session_hash}/team-locker")
async def get_team_locker(
    session_hash: str,
    user_id: str = Query(min_length=1),
) -> dict[str, Any]:
    # TODO: Load roster and team claims from catalog and session persistence.
    """Return the mock roster and current claims for a session.

    Args:
        session_hash: Public session code whose locker is requested.
        user_id: Participant viewing the locker.

    Returns:
        Team roster, claim statuses, and summary counts.
    """

    return _make_team_locker_snapshot(session_hash, user_id)


@router.post("/{session_hash}/team-locker/claim")
async def claim_team(
    session_hash: str,
    payload: TeamClaimRequest,
) -> dict[str, Any]:
    # TODO: Persist claims atomically and enforce uniqueness in the database.
    """Temporarily claim an available team for a participant.

    Args:
        session_hash: Public session code containing the locker.
        payload: Participant and team identifiers.

    Returns:
        The refreshed locker snapshot after the claim.

    Raises:
        HTTPException: If the participant already claimed a team or the team is
            missing or unavailable.
    """

    claims = MOCK_SESSION_TEAM_CLAIMS.setdefault(session_hash, {})
    if payload.user_id in claims:
        raise HTTPException(status_code=409, detail="already_claimed")
    if not any(team["id"] == payload.team_id for team in MOCK_TEAMS):
        raise HTTPException(status_code=404, detail="team_not_found")
    if payload.team_id in claims.values():
        raise HTTPException(status_code=409, detail="team_unavailable")

    claims[payload.user_id] = payload.team_id
    return _make_team_locker_snapshot(session_hash, payload.user_id)
