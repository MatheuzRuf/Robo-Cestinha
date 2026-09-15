import math
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Match


async def seed_bracket(db: AsyncSession, session_id: uuid.UUID, team_ids: list[uuid.UUID]) -> None:
    num_teams = len(team_ids)
    num_rounds = int(math.log2(num_teams))

    rounds: list[list[Match]] = []
    matches_in_round = num_teams // 2
    for round_index in range(num_rounds):
        round_matches = [
            Match(
                id=uuid.uuid4(),
                session_id=session_id,
                round=round_index,
                slot_in_round=slot,
                status="locked",
            )
            for slot in range(matches_in_round)
        ]
        rounds.append(round_matches)
        matches_in_round //= 2

    for round_index in range(num_rounds - 1):
        for match in rounds[round_index]:
            next_match = rounds[round_index + 1][match.slot_in_round // 2]
            match.next_match_id = next_match.id
            match.next_match_slot = "home" if match.slot_in_round % 2 == 0 else "away"

    remaining = list(team_ids)
    for match in rounds[0]:
        match.home_team_id = remaining.pop(0)
        match.away_team_id = remaining.pop(0)
        match.status = "ready"

    for round_matches in rounds:
        db.add_all(round_matches)
