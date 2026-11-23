import uuid
from types import SimpleNamespace

import pytest
from app.db.models import Team, User
from app.domain.teams.errors import (
    AlreadyClaimedError,
    ParticipantNotFoundError,
    TeamClaimConflictError,
)
from app.domain.teams.repository import TeamRepository
from sqlalchemy import UniqueConstraint
from sqlalchemy.exc import IntegrityError


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def scalars(self):
        return self

    def all(self):
        return self.rows

    def scalar_one_or_none(self):
        return self.rows[0] if self.rows else None


class FakeDatabase:
    def __init__(self, results=None, participant=None):
        self.results = list(results or [])
        self.participant = participant
        self.statement = None
        self.flush_error = None
        self.flush_count = 0
        self.commit_count = 0
        self.rollback_count = 0

    async def execute(self, statement):
        self.statement = statement
        if self.participant is not None:
            return FakeResult([self.participant])
        if not self.results:
            return FakeResult([])
        return self.results.pop(0)

    async def flush(self):
        self.flush_count += 1
        if self.flush_error:
            raise self.flush_error

    async def commit(self):
        self.commit_count += 1

    async def rollback(self):
        self.rollback_count += 1


@pytest.mark.asyncio
async def test_get_locker_context_uses_assigned_first_round_teams_and_order():
    session_id = uuid.uuid4()
    user_id = uuid.uuid4()
    team_a_id, team_b_id = uuid.uuid4(), uuid.uuid4()
    participant = SimpleNamespace(id=user_id, team_id=None)
    first_round_match = SimpleNamespace(
        home_team_id=team_a_id,
        away_team_id=team_b_id,
    )
    team_a = SimpleNamespace(id=team_a_id)
    team_b = SimpleNamespace(id=team_b_id)
    player = SimpleNamespace(team_id=team_a_id)
    claim = SimpleNamespace(team_id=team_a_id, id=user_id)
    finished_match = SimpleNamespace(
        home_team_id=team_a_id,
        away_team_id=team_b_id,
        winner_team_id=team_a_id,
    )
    database = FakeDatabase(
        results=[
            FakeResult([participant]),
            FakeResult([first_round_match]),
            FakeResult([team_b, team_a]),
            FakeResult([player]),
            FakeResult([claim]),
            FakeResult([finished_match]),
        ]
    )
    repository = TeamRepository(database)

    context = await repository.get_locker_context(session_id, user_id)

    assert context.participant is participant
    assert [team.id for team in context.teams] == [team_a_id, team_b_id]
    assert context.players_by_team == {team_a_id: [player]}
    assert context.team_claims == {team_a_id: user_id}
    assert context.eliminated_team_ids == {team_b_id}
    assert context.bracket_generated is True


@pytest.mark.asyncio
async def test_claim_team_locks_participant_and_commits_assignment():
    participant = SimpleNamespace(team_id=None)
    database = FakeDatabase(participant=participant)
    repository = TeamRepository(database)
    session_id, user_id, team_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()

    await repository.claim_team(session_id, user_id, team_id)

    assert database.statement._for_update_arg is not None
    assert participant.team_id == team_id
    assert database.flush_count == 1
    assert database.commit_count == 1
    assert database.rollback_count == 0


@pytest.mark.asyncio
async def test_claim_team_maps_unique_session_team_conflict():
    participant = SimpleNamespace(team_id=None)
    database = FakeDatabase(participant=participant)
    original_error = SimpleNamespace(
        diag=SimpleNamespace(constraint_name="uq_users_session_team")
    )
    database.flush_error = IntegrityError("claim", {}, original_error)
    repository = TeamRepository(database)

    with pytest.raises(TeamClaimConflictError):
        await repository.claim_team(uuid.uuid4(), uuid.uuid4(), uuid.uuid4())

    assert database.rollback_count == 1
    assert database.commit_count == 0


@pytest.mark.asyncio
async def test_claim_team_rejects_missing_or_already_assigned_participant():
    repository = TeamRepository(FakeDatabase())
    with pytest.raises(ParticipantNotFoundError):
        await repository.claim_team(uuid.uuid4(), uuid.uuid4(), uuid.uuid4())

    repository = TeamRepository(
        FakeDatabase(participant=SimpleNamespace(team_id=uuid.uuid4()))
    )
    with pytest.raises(AlreadyClaimedError):
        await repository.claim_team(uuid.uuid4(), uuid.uuid4(), uuid.uuid4())


def test_user_model_prevents_duplicate_team_claims_within_a_session():
    constraints = {
        constraint.name: tuple(column.name for column in constraint.columns)
        for constraint in User.__table__.constraints
        if isinstance(constraint, UniqueConstraint)
    }

    assert constraints["uq_users_session_team"] == ("session_id", "team_id")
    assert Team.__table__.c.season.nullable is False
