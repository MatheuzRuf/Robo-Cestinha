import pytest
from app.api.routers import teams
from app.api.schemas.team import TeamClaimRequest
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_team_locker_claim_rejects_duplicate_claims():
    session_hash = "#RC-TEST-CLAIM"
    teams.MOCK_SESSION_TEAM_CLAIMS.pop(session_hash, None)

    try:
        snapshot = await teams.get_team_locker(session_hash, user_id="user-one")
        assert snapshot["totalTeamCount"] == 8
        assert snapshot["openTeamCount"] == 8

        updated = await teams.claim_team(
            session_hash,
            TeamClaimRequest(user_id="user-one", team_id=snapshot["teams"][0]["id"]),
        )
        assert updated["myTeamId"] == snapshot["teams"][0]["id"]

        with pytest.raises(HTTPException) as error:
            await teams.claim_team(
                session_hash,
                TeamClaimRequest(
                    user_id="user-two", team_id=snapshot["teams"][0]["id"]
                ),
            )

        assert error.value.status_code == 409
        assert error.value.detail == "team_unavailable"
    finally:
        teams.MOCK_SESSION_TEAM_CLAIMS.pop(session_hash, None)
