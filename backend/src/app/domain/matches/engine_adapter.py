"""Map persisted match data to the engine and back to domain results."""

from __future__ import annotations

from app.data_ingestion.schemas import Player as EnginePlayer
from app.data_ingestion.schemas import PlayerAttributes, TeamStats
from app.data_ingestion.schemas import Team as EngineTeam
from app.domain.matches.types import EngineIdMap, MatchContext, MatchSimulationResult
from app.engine.entities import LiveTeam
from app.engine.match_runner import MatchRunner
from app.engine.schemas import EngineSimulationResult, SimulationEvent, SimulationFrame

GRID_WIDTH = 9.0
GRID_HEIGHT = 4.0
COURT_WIDTH = 94.0
COURT_HEIGHT = 50.0


class MatchEngineAdapter:
    """Translate between database records and engine inputs and outputs."""

    def run(
        self, context: MatchContext, iterations: int, seed: int
    ) -> EngineSimulationResult:
        """Build the engine teams and run a bounded simulation.

        Args:
            context: Match context with both teams and their players.
            iterations: Maximum number of normal-play transitions.
            seed: Random seed recorded on the reserved simulation.

        Returns:
            The engine result using catalog ids and grid coordinates.
        """

        home, away = self._build_ignition_teams(context)
        players = [_engine_player(p, context) for p in context.home_players] + [
            _engine_player(p, context) for p in context.away_players
        ]
        home_live = LiveTeam.from_team_and_players(home, players)
        away_live = LiveTeam.from_team_and_players(away, players)
        runner = MatchRunner(home_live, away_live, seed=seed)
        return runner.run_simulation(iterations)

    def to_domain_result(
        self,
        engine: EngineSimulationResult,
        context: MatchContext,
        iterations: int,
    ) -> MatchSimulationResult:
        """Convert an engine result into the API-shaped domain result.

        Args:
            engine: Engine result using catalog ids and grid coordinates.
            context: Original match context for id and roster mapping.
            iterations: Requested iteration limit.

        Returns:
            A result with database UUIDs and 0..94 / 0..50 court coordinates.
        """

        id_map = self._build_id_map(context)

        frames = [self._map_frame(frame, id_map) for frame in engine.frames]
        events = [self._map_event(event, id_map) for event in engine.events]

        return MatchSimulationResult(
            match_id=context.match_id,
            session_hash=context.session_hash,
            iterations_limit=iterations,
            iterations_completed=engine.iterations_completed,
            overtime_iterations=engine.overtime_iterations,
            termination_reason=engine.termination_reason,
            home_score=engine.home_score,
            away_score=engine.away_score,
            winner_team_id=id_map.team_id_by_engine[engine.winner_team_id],
            teams={
                "home": {
                    "teamId": context.home_team.id,
                    "nbaTeamId": getattr(context.home_team, "nba_team_id", None),
                    "name": context.home_team.name,
                    "abbreviation": context.home_team.abbreviation,
                },
                "away": {
                    "teamId": context.away_team.id,
                    "nbaTeamId": getattr(context.away_team, "nba_team_id", None),
                    "name": context.away_team.name,
                    "abbreviation": context.away_team.abbreviation,
                },
            },
            players=list(self._player_metadata(context, id_map)),
            frames=frames,
            events=events,
            engine_version=engine.engine_version,
        )

    def _build_id_map(self, context: MatchContext) -> EngineIdMap:
        """Map engine (catalog) ids to database ids for both teams."""
        team_map = {
            _engine_id(context.home_team): context.home_team.id,
            _engine_id(context.away_team): context.away_team.id,
        }
        player_map = {}
        for player in context.home_players + context.away_players:
            player_map[_engine_id(player)] = player.id
        return EngineIdMap(
            team_id_by_engine=team_map,
            player_id_by_engine=player_map,
        )

    def _build_ignition_teams(
        self, context: MatchContext
    ) -> tuple[EngineTeam, EngineTeam]:
        home = self._team_to_engine(context.home_team, context.home_players)
        away = self._team_to_engine(context.away_team, context.away_players)
        return home, away

    @staticmethod
    def _team_to_engine(team, players) -> EngineTeam:
        return EngineTeam(
            team_id=_engine_id(team),
            name=team.name,
            abbreviation=team.abbreviation or "TBA",
            roster=[_engine_id(player) for player in players],
            team_stats=TeamStats(pace=1.0, off_rtg=100.0, def_rtg=100.0),
            season="2025",
        )

    def _player_metadata(self, context, id_map: EngineIdMap):
        def rows(side):
            players = context.home_players if side == "home" else context.away_players
            for player in players:
                yield {
                    "playerId": player.id,
                    "nbaPlayerId": getattr(player, "nba_player_id", None),
                    "teamId": player.team_id,
                    "side": side,
                    "name": player.name,
                    "position": player.position5 or player.position,
                    "number": None,
                }

        yield from rows("home")
        yield from rows("away")

    @staticmethod
    def _map_frame(frame: SimulationFrame, id_map: EngineIdMap) -> dict:
        return {
            "iteration": frame.iteration,
            "playerWithBallId": _map_optional_id(
                frame.player_with_ball_id, id_map.player_id_by_engine
            ),
            "players": [
                {
                    "playerId": id_map.player_id_by_engine[position.player_id],
                    "x": _map_x(position.x),
                    "y": _map_y(position.y),
                }
                for position in frame.players
            ],
            "ball": {
                "x": _map_x(frame.ball.x),
                "y": _map_y(frame.ball.y),
                "height": 0.0,
                "trajectory": _map_trajectory(frame.ball.trajectory, id_map),
            },
            "score": {"home": frame.score.home, "away": frame.score.away},
            "possessionTeamId": _map_optional_id(
                frame.possession_team_id, id_map.team_id_by_engine
            ),
        }

    @staticmethod
    def _map_event(event: SimulationEvent, id_map: EngineIdMap) -> dict:
        data = dict(event.data)
        if event.type == "game_finished" and "winnerTeamId" in data:
            data["winnerTeamId"] = str(id_map.team_id_by_engine[data["winnerTeamId"]])
        return {
            "sequence": event.sequence,
            "iteration": event.iteration,
            "type": event.type,
            "teamId": _map_optional_id(event.team_id, id_map.team_id_by_engine),
            "playerId": _map_optional_id(event.player_id, id_map.player_id_by_engine),
            "targetPlayerId": _map_optional_id(
                event.target_player_id, id_map.player_id_by_engine
            ),
            "data": data,
        }


def _engine_id(record) -> str:
    """Return the engine-facing id (catalog slug) for a model record."""
    catalog_id = getattr(record, "catalog_id", None)
    return catalog_id or str(record.id)


def _engine_player(player, context: MatchContext) -> EnginePlayer:
    """Convert a database player into the validated ingestion schema player."""
    team = (
        context.home_team
        if player.team_id == context.home_team.id
        else context.away_team
    )
    return EnginePlayer(
        player_id=_engine_id(player),
        team_id=_engine_id(team),
        name=player.name,
        position=player.position or "G",
        position5=player.position5 or "PG",
        is_starter=bool(player.is_starter),
        attributes=PlayerAttributes(**player.attributes),
    )


def _map_optional_id(value, id_map):
    if value is None:
        return None
    return id_map[value]


def _map_x(value: int) -> int:
    return round(value * COURT_WIDTH / GRID_WIDTH)


def _map_y(value: int) -> int:
    return round(value * COURT_HEIGHT / GRID_HEIGHT)


def _map_trajectory(trajectory, id_map):
    if trajectory is None:
        return None
    return {
        "type": trajectory.type,
        "fromPosition": {
            "x": _map_x(trajectory.from_position[0]),
            "y": _map_y(trajectory.from_position[1]),
        },
        "toPosition": {
            "x": _map_x(trajectory.to_position[0]),
            "y": _map_y(trajectory.to_position[1]),
        },
        "fromPlayerId": _map_optional_id(
            trajectory.from_player_id, id_map.player_id_by_engine
        ),
        "toPlayerId": _map_optional_id(
            trajectory.to_player_id, id_map.player_id_by_engine
        ),
        "fromTeamId": None,
        "toTeamId": None,
        "progress": 1.0,
    }
