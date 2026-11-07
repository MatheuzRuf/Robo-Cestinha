import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from app.db.models import (
    Match,
    MatchEvent,
    MatchFrameChunk,
    MatchSimulation,
    Player,
    Session,
    Team,
)
from app.domain.matches.errors import (
    MatchAlreadySimulatedError,
    MatchNotReadyError,
    MatchOrSessionNotFoundError,
)
from app.domain.matches.repository import MatchRepository
from app.domain.matches.types import MatchSimulationResult


class FakeResult:
    def __init__(self, scalar=None, scalars=None):
        self._scalar = scalar
        self._scalars = scalars or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalars(self):
        class _Scalars:
            def __init__(self, values):
                self._values = values

            def all(self):
                return list(self._values)

        return _Scalars(self._scalars)


class FakeDatabase:
    def __init__(self, script=None, fail_on_flush=False):
        self.script = list(script or [])
        self.fail_on_flush = fail_on_flush
        self.added = []
        self.added_all = []
        self.commits = 0

    async def execute(self, statement):
        if not self.script:
            raise AssertionError("no canned result left for execute")
        return self.script.pop(0)

    def add(self, entity):
        self.added.append(entity)

    def add_all(self, entities):
        self.added_all.extend(entities)

    async def flush(self):
        if self.fail_on_flush:
            raise IntegrityError("u", "s", Exception("dup"))

    async def commit(self):
        self.commits += 1

    async def refresh(self, entity):
        pass


def _simulation(match_id, status="running"):
    return MatchSimulation(
        id=uuid.uuid4(),
        match_id=match_id,
        status=status,
        iterations_limit=30,
        iterations_completed=0,
        overtime_iterations=0,
        random_seed=5,
        started_at=None,
    )


def _match(
    session_id,
    *,
    next_match_id=None,
    next_match_slot=None,
    home=None,
    away=None,
    status="ready",
):
    return Match(
        id=uuid.uuid4(),
        session_id=session_id,
        round=0,
        slot_in_round=0,
        status=status,
        home_team_id=home,
        away_team_id=away,
        next_match_id=next_match_id,
        next_match_slot=next_match_slot,
        home_score=0,
        away_score=0,
    )


def _session(session_id):
    return Session(id=session_id, hash="RC-X")


def _team(team_id):
    return Team(id=team_id, name="Team", abbreviation="TM")


def _player(team_id, index=0):
    return Player(
        id=uuid.uuid4(),
        team_id=team_id,
        name=f"P{index}",
        attributes={},
    )


def _context_result(match, home_team, away_team):
    return MatchSimulationResult(
        match_id=match.id,
        session_hash="RC-X",
        iterations_limit=30,
        iterations_completed=30,
        overtime_iterations=0,
        termination_reason="iteration_limit",
        home_score=12,
        away_score=9,
        winner_team_id=home_team.id,
        teams={},
        players=[],
        frames=[
            {"iteration": 0, "players": []},
            {"iteration": 1, "players": []},
        ],
        events=[
            {
                "sequence": 1,
                "iteration": 0,
                "type": "game_started",
                "teamId": None,
                "playerId": None,
                "targetPlayerId": None,
                "data": {},
            },
        ],
        engine_version="1.0.0",
    )


@pytest.mark.asyncio
async def test_get_match_context_loads_ready_match():
    session_id = uuid.uuid4()
    home = _team(uuid.uuid4())
    away = _team(uuid.uuid4())
    match = _match(session_id, home=home.id, away=away.id)
    session = _session(session_id)
    db = FakeDatabase(
        script=[
            FakeResult(scalar=session),
            FakeResult(scalar=match),
            FakeResult(scalar=home),
            FakeResult(scalar=away),
            FakeResult(scalars=[_player(home.id, 0)]),
            FakeResult(scalars=[_player(away.id, 0)]),
        ]
    )
    context = await MatchRepository(db).get_match_context("RC-X", match.id)
    assert context.match_id == match.id
    assert context.session_hash == "RC-X"
    assert context.home_team is home
    assert context.away_team is away
    assert len(context.home_players) == 1


@pytest.mark.asyncio
async def test_get_match_context_rejects_missing_session():
    db = FakeDatabase(script=[FakeResult(scalar=None)])
    with pytest.raises(MatchOrSessionNotFoundError):
        await MatchRepository(db).get_match_context("RC-X", uuid.uuid4())


@pytest.mark.asyncio
async def test_get_match_context_rejects_missing_match_in_session():
    session_id = uuid.uuid4()
    db = FakeDatabase(
        script=[
            FakeResult(scalar=_session(session_id)),
            FakeResult(scalar=None),
        ]
    )
    with pytest.raises(MatchOrSessionNotFoundError):
        await MatchRepository(db).get_match_context("RC-X", uuid.uuid4())


@pytest.mark.asyncio
async def test_get_match_context_rejects_not_ready_match():
    session_id = uuid.uuid4()
    match = _match(session_id, status="locked", home=uuid.uuid4(), away=uuid.uuid4())
    db = FakeDatabase(
        script=[
            FakeResult(scalar=_session(session_id)),
            FakeResult(scalar=match),
        ]
    )
    with pytest.raises(MatchNotReadyError):
        await MatchRepository(db).get_match_context("RC-X", match.id)


@pytest.mark.asyncio
async def test_reserve_simulation_creates_and_commits_one_record():
    match_id = uuid.uuid4()
    db = FakeDatabase(
        script=[
            FakeResult(
                scalar=_match(uuid.uuid4(), home=uuid.uuid4(), away=uuid.uuid4())
            ),
            FakeResult(scalar=None),
        ]
    )
    record = await MatchRepository(db).reserve_simulation(match_id, iterations=30)
    assert db.commits == 1
    assert db.added[0].match_id == match_id
    assert record.id == db.added[0].id
    assert record.random_seed is not None


@pytest.mark.asyncio
async def test_reserve_simulation_rejects_duplicate_existing():
    match_id = uuid.uuid4()
    db = FakeDatabase(
        script=[
            FakeResult(
                scalar=_match(uuid.uuid4(), home=uuid.uuid4(), away=uuid.uuid4())
            ),
            FakeResult(scalar=_simulation(match_id)),
        ]
    )
    with pytest.raises(MatchAlreadySimulatedError):
        await MatchRepository(db).reserve_simulation(match_id, iterations=30)


@pytest.mark.asyncio
async def test_reserve_simulation_surfaces_unique_constraint_violation():
    match_id = uuid.uuid4()
    db = FakeDatabase(
        script=[
            FakeResult(
                scalar=_match(uuid.uuid4(), home=uuid.uuid4(), away=uuid.uuid4())
            ),
            FakeResult(scalar=None),
        ],
        fail_on_flush=True,
    )
    with pytest.raises(MatchAlreadySimulatedError):
        await MatchRepository(db).reserve_simulation(match_id, iterations=30)
    assert db.commits == 0


@pytest.mark.asyncio
async def test_complete_simulation_persists_result_and_finishes_match():
    session_id = uuid.uuid4()
    home = _team(uuid.uuid4())
    match = _match(session_id, home=home.id, away=uuid.uuid4())
    sim = _simulation(match.id)
    result = _context_result(match, home, None)
    db = FakeDatabase(
        script=[
            FakeResult(scalar=sim),
            FakeResult(scalar=match),
        ]
    )
    await MatchRepository(db).complete_simulation(sim.id, result)
    assert sim.status == "completed"
    assert match.status == "finished"
    assert match.home_score == 12
    assert match.winner_team_id == home.id
    assert any(isinstance(e, MatchEvent) for e in db.added_all)
    assert any(isinstance(c, MatchFrameChunk) for c in db.added)
    assert db.commits == 1


@pytest.mark.asyncio
async def test_complete_simulation_advances_winner_to_next_match():
    session_id = uuid.uuid4()
    home = _team(uuid.uuid4())
    next_match = _match(session_id, home=None, away=uuid.uuid4())
    match = _match(
        session_id,
        next_match_id=next_match.id,
        next_match_slot="home",
        home=home.id,
        away=uuid.uuid4(),
    )
    sim = _simulation(match.id)
    result = _context_result(match, home, None)
    db = FakeDatabase(
        script=[
            FakeResult(scalar=sim),
            FakeResult(scalar=match),
            FakeResult(scalar=next_match),
        ]
    )
    await MatchRepository(db).complete_simulation(sim.id, result)
    assert next_match.home_team_id == home.id
    assert next_match.status == "ready"


@pytest.mark.asyncio
async def test_fail_simulation_marks_failed_without_match_changes():
    sim = _simulation(uuid.uuid4())
    db = FakeDatabase(script=[FakeResult(scalar=sim)])
    await MatchRepository(db).fail_simulation(sim.id, "engine_error")
    assert sim.status == "failed"
    assert sim.termination_reason == "engine_error"
    assert db.commits == 1
