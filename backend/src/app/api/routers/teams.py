import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.api.schemas.team import TeamClaimRequest

router = APIRouter()

MOCK_SESSION_TEAM_CLAIMS: dict[str, dict[str, str]] = {}
MOCK_SESSION_TEAM_IDS = ("bkn", "nyk", "bos", "gsw", "okc", "lal", "den", "phi")
PROCESSED_DATA_DIR = Path(__file__).resolve().parents[5] / "data" / "processed"


def _load_mock_teams() -> list[dict[str, Any]]:
    """Load the mock locker roster from processed catalog data.

    Returns:
        The selected catalog teams in the locker response shape.
    """

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
    """Build a mock locker snapshot with the current in-memory claims.

    Args:
        session_hash: Public session code whose locker is requested.
        user_id: Participant viewing the locker.

    Returns:
        Team roster, claim statuses, and summary counts.
    """

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


@router.get("/{session_hash}/team-locker")
async def get_team_locker(
    session_hash: str,
    user_id: str = Query(min_length=1),
) -> dict[str, Any]:
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
