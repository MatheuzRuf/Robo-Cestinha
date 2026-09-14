"""Spatial 50-cell grid system for the basketball court.

Discretized 10x5 grid (50 cells total), representing the NBA 94x50 ft court
at a 2:1 ratio. No out-of-bounds: all positions clamp to [0, 9] x [0, 4].
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import Enum
from typing import Tuple


class Direction(str, Enum):
    N = "N"
    NE = "NE"
    E = "E"
    SE = "SE"
    S = "S"
    SW = "SW"
    W = "W"
    NW = "NW"
    IDLE = "IDLE"


DIRECTION_VECTORS: dict[Direction, Tuple[int, int]] = {
    Direction.N: (0, 1),
    Direction.NE: (1, 1),
    Direction.E: (1, 0),
    Direction.SE: (1, -1),
    Direction.S: (0, -1),
    Direction.SW: (-1, -1),
    Direction.W: (-1, 0),
    Direction.NW: (-1, 1),
    Direction.IDLE: (0, 0),
}


GRID_WIDTH = 10   # X: 0 .. 9
GRID_HEIGHT = 5   # Y: 0 .. 4
TOTAL_CELLS = 50

# Rims
RIM_A = (0, 2)  # Team A defends Rim A, Team B attacks Rim A
RIM_B = (9, 2)  # Team B defends Rim B, Team A attacks Rim B

THREE_POINT_DISTANCE_THRESHOLD = 3.0  # Euclidean distance >= 3.0 cells is a 3-pointer


@dataclass(frozen=True)
class CourtPosition:
    x: int
    y: int

    def __post_init__(self) -> None:
        clamped_x = max(0, min(GRID_WIDTH - 1, self.x))
        clamped_y = max(0, min(GRID_HEIGHT - 1, self.y))
        if clamped_x != self.x or clamped_y != self.y:
            object.__setattr__(self, "x", clamped_x)
            object.__setattr__(self, "y", clamped_y)

    def move(self, direction: Direction) -> CourtPosition:
        dx, dy = DIRECTION_VECTORS[direction]
        return CourtPosition(self.x + dx, self.y + dy)

    def distance_to(self, other: CourtPosition | Tuple[int, int]) -> float:
        ox = other[0] if isinstance(other, tuple) else other.x
        oy = other[1] if isinstance(other, tuple) else other.y
        return math.hypot(self.x - ox, self.y - oy)

    def to_tuple(self) -> Tuple[int, int]:
        return (self.x, self.y)


def get_target_rim(attacking_team_is_a: bool) -> Tuple[int, int]:
    """Team A attacks Rim B (9, 2). Team B attacks Rim A (0, 2)."""
    return RIM_B if attacking_team_is_a else RIM_A


def is_three_pointer(position: CourtPosition, attacking_team_is_a: bool) -> bool:
    """True if shot position is >= 3.0 cells from the target basket rim."""
    rim = get_target_rim(attacking_team_is_a)
    return position.distance_to(rim) >= THREE_POINT_DISTANCE_THRESHOLD


def get_initial_center_positions(is_team_a: bool) -> list[CourtPosition]:
    """Initial positions for 5 players starting near center court."""
    if is_team_a:
        # Team A offensive side (columns 3-4, facing right towards 9)
        return [
            CourtPosition(4, 2),  # PG (top of the key / center)
            CourtPosition(4, 3),  # SG (wing right)
            CourtPosition(4, 1),  # SF (wing left)
            CourtPosition(3, 3),  # PF (high post)
            CourtPosition(3, 1),  # C (center/interior)
        ]
    else:
        # Team B defensive side (columns 5-6, facing left towards 0)
        return [
            CourtPosition(5, 2),  # PG (defending center)
            CourtPosition(5, 3),  # SG (defending wing)
            CourtPosition(5, 1),  # SF (defending wing)
            CourtPosition(6, 3),  # PF (defending interior)
            CourtPosition(6, 1),  # C (defending rim/interior)
        ]
