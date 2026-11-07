from sqlalchemy import UniqueConstraint

from app.db.models import MatchEvent, MatchFrameChunk, MatchSimulation


def _unique_sets(table):
    uniques = set()
    for constraint in table.constraints:
        if isinstance(constraint, UniqueConstraint):
            uniques.add(frozenset(column.name for column in constraint.columns))
    for column in table.columns:
        if column.unique:
            uniques.add(frozenset((column.name,)))
    return uniques


def test_match_simulation_sets_unique_match_id():
    unique = _unique_sets(MatchSimulation.__table__)
    assert frozenset(("match_id",)) in unique


def test_match_event_constrains_simulation_and_sequence():
    unique = _unique_sets(MatchEvent.__table__)
    assert frozenset(("simulation_id", "sequence")) in unique


def test_match_frame_chunk_constrains_simulation_and_index():
    unique = _unique_sets(MatchFrameChunk.__table__)
    assert frozenset(("simulation_id", "chunk_index")) in unique
