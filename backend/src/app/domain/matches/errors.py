"""Domain errors raised by the match service and repository."""


class MatchOrSessionNotFoundError(LookupError):
    """Raised when a session or its match cannot be resolved."""


class MatchNotReadyError(RuntimeError):
    """Raised when a match is not ready to be simulated."""


class MatchAlreadySimulatedError(RuntimeError):
    """Raised when a match already has a simulation run."""


class InvalidIterationsError(ValueError):
    """Raised when the requested iteration count is out of bounds."""


class SimulationFailedError(RuntimeError):
    """Raised when the engine run or persistence of a simulation fails."""
