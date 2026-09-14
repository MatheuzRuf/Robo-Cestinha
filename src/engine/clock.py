"""Game clock and shot clock management for the basketball simulator.

Standard NBA timing:
- 4 quarters of 12 minutes (720s) each.
- Overtime periods of 5 minutes (300s) if tied at regulation end.
- 24-second shot clock (resets to 14s after offensive rebounds).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class GameClock:
    quarter: int = 1
    game_clock_remaining: float = 720.0  # seconds left in current period
    shot_clock_remaining: float = 24.0   # seconds left in current possession
    quarter_duration_s: float = 720.0    # 12 min
    ot_duration_s: float = 300.0         # 5 min
    is_game_over: bool = False

    def reset_for_new_possession(self, is_offensive_rebound: bool = False) -> None:
        """Reset the shot clock for a new possession or offensive board."""
        if is_offensive_rebound:
            # 14s or remaining quarter time, whichever is smaller
            reset_val = min(14.0, self.game_clock_remaining)
        else:
            reset_val = min(24.0, self.game_clock_remaining)
        self.shot_clock_remaining = max(0.0, reset_val)

    def tick(self, duration_s: float) -> tuple[float, bool]:
        """Advances time by duration_s (or until quarter/shot clock runs out).

        Returns:
            (elapsed_seconds, shot_clock_violation)
        """
        if duration_s <= 0:
            return 0.0, False

        # Cannot exceed remaining period time or remaining shot clock
        actual_elapsed = min(duration_s, self.game_clock_remaining, self.shot_clock_remaining)
        self.game_clock_remaining = max(0.0, self.game_clock_remaining - actual_elapsed)
        self.shot_clock_remaining = max(0.0, self.shot_clock_remaining - actual_elapsed)

        shot_clock_violation = (self.shot_clock_remaining <= 0.0 and self.game_clock_remaining > 0.0)
        return actual_elapsed, shot_clock_violation

    def is_quarter_ended(self) -> bool:
        return self.game_clock_remaining <= 0.0

    def start_next_period(self, is_overtime: bool = False) -> int:
        """Advances to the next quarter or overtime."""
        self.quarter += 1
        duration = self.ot_duration_s if is_overtime else self.quarter_duration_s
        self.game_clock_remaining = duration
        self.shot_clock_remaining = min(24.0, duration)
        return self.quarter

    def formatted_time(self) -> str:
        """Returns MM:SS formatted string for current quarter clock."""
        total_seconds = int(self.game_clock_remaining)
        minutes = total_seconds // 60
        seconds = total_seconds % 60
        return f"{minutes:02d}:{seconds:02d}"
