import uuid

import pytest

from app.domain.matches.errors import (
    InvalidIterationsError,
    MatchNotReadyError,
    SimulationFailedError,
)
from app.domain.matches.service import MatchService
from app.domain.matches.types import (
    MatchContext,
    MatchSimulationResult,
    SimulationRecord,
)
from app.engine.schemas import EngineSimulationResult


class FakeRepository:
    def __init__(self):
        self.context_error = None
        self.reserved = SimulationRecord(id=uuid.uuid4(), random_seed=7)
        self.completed = []
        self.failed = []
        self.complete_error = None
        self.context = MatchContext(
            match_id=uuid.uuid4(),
            session_id=uuid.uuid4(),
            session_hash="RC-X",
            match=None,
            home_team=None,
            away_team=None,
            home_players=[],
            away_players=[],
        )

    async def get_match_context(self, session_hash, match_id):
        if self.context_error is not None:
            raise self.context_error
        return self.context

    async def reserve_simulation(self, match_id, iterations):
        return self.reserved

    async def complete_simulation(self, simulation_id, result):
        if self.complete_error is not None:
            raise self.complete_error
        self.completed.append((simulation_id, result))

    async def fail_simulation(self, simulation_id, error_code):
        self.failed.append((simulation_id, error_code))


class FakeAdapter:
    def __init__(self, run_error=None):
        self.run_error = run_error
        self.run_calls = 0
        self.engine = EngineSimulationResult(
            iterations_completed=30,
            overtime_iterations=0,
            home_score=10,
            away_score=8,
            winner_team_id="home",
            termination_reason="iteration_limit",
        )

    def run(self, context, iterations, seed):
        self.run_calls += 1
        if self.run_error is not None:
            raise self.run_error
        return self.engine

    def to_domain_result(self, engine, context, iterations):
        return MatchSimulationResult(
            match_id=context.match_id,
            session_hash=context.session_hash,
            iterations_limit=iterations,
            iterations_completed=engine.iterations_completed,
            overtime_iterations=engine.overtime_iterations,
            termination_reason=engine.termination_reason,
            home_score=engine.home_score,
            away_score=engine.away_score,
            winner_team_id=uuid.uuid4(),
            teams={},
            players=[],
            frames=[],
            events=[],
            engine_version="1.0.0",
        )


def _service(repository=None, adapter=None):
    repo = repository or FakeRepository()
    adapter = adapter or FakeAdapter()
    return (
        MatchService(repository=repo, engine_adapter=adapter, max_iterations=1000),
        repo,
        adapter,
    )


@pytest.mark.asyncio
async def test_service_runs_and_completes_a_simulation():
    service, repo, adapter = _service()
    result = await service.simulate_match("RC-X", uuid.uuid4(), iterations=30)
    assert result.iterations_completed == 30
    assert adapter.run_calls == 1
    assert repo.completed == [(repo.reserved.id, result)]
    assert repo.failed == []


@pytest.mark.asyncio
async def test_service_rejects_out_of_bounds_iterations():
    service, repo, adapter = _service()
    with pytest.raises(InvalidIterationsError):
        await service.simulate_match("RC-X", uuid.uuid4(), iterations=1001)
    with pytest.raises(InvalidIterationsError):
        await service.simulate_match("RC-X", uuid.uuid4(), iterations=0)
    assert adapter.run_calls == 0
    assert repo.completed == []


@pytest.mark.asyncio
async def test_service_marks_failed_when_engine_raises():
    service, repo, adapter = _service(
        adapter=FakeAdapter(run_error=RuntimeError("boom"))
    )
    with pytest.raises(SimulationFailedError):
        await service.simulate_match("RC-X", uuid.uuid4(), iterations=30)
    assert repo.completed == []
    assert repo.failed == [(repo.reserved.id, "engine_error")]


@pytest.mark.asyncio
async def test_service_marks_failed_when_completion_raises():
    service, repo, adapter = _service()
    repo.complete_error = RuntimeError("commit failed")
    with pytest.raises(SimulationFailedError):
        await service.simulate_match("RC-X", uuid.uuid4(), iterations=30)
    assert repo.failed == [(repo.reserved.id, "engine_error")]


@pytest.mark.asyncio
async def test_service_propagates_readiness_and_not_found_errors():
    service, repo, adapter = _service()
    repo.context_error = MatchNotReadyError("x")
    with pytest.raises(MatchNotReadyError):
        await service.simulate_match("RC-X", uuid.uuid4(), iterations=30)
    assert adapter.run_calls == 0
    assert repo.failed == []
