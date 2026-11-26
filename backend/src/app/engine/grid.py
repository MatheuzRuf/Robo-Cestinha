"""Grade espacial de 50 células que representa a quadra.

Discretized 10x5 grid (50 cells total), representing the NBA 94x50 ft court
at a 2:1 ratio. No out-of-bounds: all positions clamp to [0, 9] x [0, 4].
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import Enum


class Direction(str, Enum):
    """Direções possíveis para o deslocamento de um jogador na grade."""

    N = "N"
    NE = "NE"
    E = "E"
    SE = "SE"
    S = "S"
    SW = "SW"
    W = "W"
    NW = "NW"
    IDLE = "IDLE"


DIRECTION_VECTORS: dict[Direction, tuple[int, int]] = {
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


GRID_WIDTH = 10  # X: 0 .. 9
GRID_HEIGHT = 5  # Y: 0 .. 4
TOTAL_CELLS = 50

# Rims
RIM_A = (0, 2)  # Team A defends Rim A, Team B attacks Rim A
RIM_B = (9, 2)  # Team B defends Rim B, Team A attacks Rim B

# --- Spatial realism constants ------------------------------------------------
# On-ball steals / fouls only possible when a defender is within this many
# grid cells of the ball handler.
ON_BALL_STEAL_MAX_DIST = 1.5
# Passes can only be intercepted by defenders within this many grid cells of
# the passer -> receiver segment.
PASS_INTERCEPT_MAX_DIST = 1.5
# Rebounds are primarily contested within this many grid cells of the rim.
REBOUND_MAX_CELLS = 3.0

# Canonical NBA court geometry in feet (94 x 50 ft).
COURT_WIDTH_FT = 94.0
COURT_HEIGHT_FT = 50.0
LEFT_HOOP_FT = (5.25, 25.0)
RIGHT_HOOP_FT = (88.75, 25.0)
THREE_POINT_RADIUS_FT = 23.75
MAX_NORMAL_SHOT_RANGE_FT = 31.0

# Legacy grid-cell threshold kept for backward compatibility (tests).
THREE_POINT_DISTANCE_THRESHOLD = 3.0  # Euclidean distance >= 3.0 cells is a 3-pointer


@dataclass(frozen=True)
class CourtPosition:
    """Posição imutável na quadra, sempre limitada aos seus 50 quadrados."""

    x: int
    y: int

    def __post_init__(self) -> None:
        # O clamp evita que movimentos ultrapassem as linhas da quadra.
        clamped_x = max(0, min(GRID_WIDTH - 1, self.x))
        clamped_y = max(0, min(GRID_HEIGHT - 1, self.y))
        if clamped_x != self.x or clamped_y != self.y:
            object.__setattr__(self, "x", clamped_x)
            object.__setattr__(self, "y", clamped_y)

    def move(self, direction: Direction) -> CourtPosition:
        """Cria a posição vizinha indicada, aplicando o limite da quadra."""
        dx, dy = DIRECTION_VECTORS[direction]
        return CourtPosition(self.x + dx, self.y + dy)

    def distance_to(self, other: CourtPosition | tuple[int, int]) -> float:
        """Calcula a distância euclidiana até outra posição."""
        ox = other[0] if isinstance(other, tuple) else other.x
        oy = other[1] if isinstance(other, tuple) else other.y
        return math.hypot(self.x - ox, self.y - oy)

    def to_tuple(self) -> tuple[int, int]:
        """Converte a posição para o formato usado nos logs JSON."""
        return (self.x, self.y)


def get_target_rim(attacking_team_is_a: bool) -> tuple[int, int]:
    """Retorna a cesta que o time atacante deve alcançar."""
    return RIM_B if attacking_team_is_a else RIM_A


def point_to_segment_distance(
    point: CourtPosition, start: CourtPosition, end: CourtPosition
) -> float:
    """Retorna a menor distância de ``point`` até o segmento ``start``-``end``.

    Se ``start == end``, o segmento degenera em um ponto e ``t`` é zerado.
    """
    sx, sy = start.x, start.y
    vx = end.x - sx
    vy = end.y - sy
    if vx == 0 and vy == 0:
        return point.distance_to(start)
    t = max(
        0.0, min(1.0, ((point.x - sx) * vx + (point.y - sy) * vy) / (vx * vx + vy * vy))
    )
    closest_x = sx + t * vx
    closest_y = sy + t * vy
    return math.hypot(point.x - closest_x, point.y - closest_y)


def grid_to_court_ft(position: CourtPosition) -> tuple[float, float]:
    """Mapeia uma posição da grade 10x5 para coordenadas reais de quadra (ft).

    Idêntico ao mapeamento de :func:`engine_adapter._map_x` / ``_map_y``.
    """
    return (
        float(round(position.x * COURT_WIDTH_FT / (GRID_WIDTH - 1))),
        float(round(position.y * COURT_HEIGHT_FT / (GRID_HEIGHT - 1))),
    )


def distance_to_hoop_ft(position: CourtPosition, attacking_team_is_a: bool) -> float:
    """Distância euclidiana (em pés) da posição até a cesta atacada."""
    hoop = RIGHT_HOOP_FT if attacking_team_is_a else LEFT_HOOP_FT
    x_ft, y_ft = grid_to_court_ft(position)
    return math.hypot(x_ft - hoop[0], y_ft - hoop[1])


def is_three_pointer(position: CourtPosition, attacking_team_is_a: bool) -> bool:
    """Informa se a posição está distante o suficiente para uma cesta de três.

    Usa a distância em pés até a cesta atacada comparada ao raio real do arco
    de 3 pontos (``THREE_POINT_RADIUS_FT``), para que a classificação bata 1:1
    com a linha branca de 3 pontos desenhada no frontend.
    """
    return distance_to_hoop_ft(position, attacking_team_is_a) >= THREE_POINT_RADIUS_FT


def get_initial_center_positions(is_team_a: bool) -> list[CourtPosition]:
    """Retorna as cinco posições iniciais para o saque no centro da quadra."""
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


def get_inbound_positions(is_team_a: bool) -> list[CourtPosition]:
    """Return the five slots of the team that must inbound after conceding.

    The inbounder stands on the baseline of the basket the opponent just
    scored on (Rim A for team A, Rim B for team B) with the four teammates
    spread ahead to receive the inbound pass. All five slots are unique and
    disjoint from :func:`get_defensive_reset_positions` for the same side.
    """
    if is_team_a:
        return [
            CourtPosition(1, 2),  # inbounder on the baseline near Rim A
            CourtPosition(3, 2),  # free-throw area
            CourtPosition(4, 1),  # left wing
            CourtPosition(4, 3),  # right wing
            CourtPosition(5, 2),  # top of the key
        ]
    return [
        CourtPosition(8, 2),  # inbounder on the baseline near Rim B
        CourtPosition(6, 2),  # free-throw area
        CourtPosition(5, 1),  # left wing
        CourtPosition(5, 3),  # right wing
        CourtPosition(4, 2),  # top of the key
    ]


def get_defensive_reset_positions(is_team_a: bool) -> list[CourtPosition]:
    """Return the five defensive slots mirrored against an inbound.

    ``is_team_a`` identifies the inbounding team; the returned slots belong to
    the defending team and are placed on the far half, with a rim protector
    under its defended basket. Disjoint from :func:`get_inbound_positions`.
    """
    if is_team_a:
        # Team B defending an inbound by team A near Rim A.
        return [
            CourtPosition(8, 2),  # rim protector under Rim B
            CourtPosition(7, 2),  # free-throw area
            CourtPosition(6, 1),  # left wing
            CourtPosition(6, 3),  # right wing
            CourtPosition(9, 2),  # baseline pressure near the ball
        ]
    # Team A defending an inbound by team B near Rim B.
    return [
        CourtPosition(1, 2),  # rim protector under Rim A
        CourtPosition(2, 2),  # free-throw area
        CourtPosition(3, 1),  # left wing
        CourtPosition(3, 3),  # right wing
        CourtPosition(0, 2),  # baseline pressure near the ball
    ]
