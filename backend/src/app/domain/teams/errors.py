class ParticipantNotFoundError(LookupError):
    """Raised when a user does not belong to the requested session."""


class BracketNotGeneratedError(LookupError):
    """Raised when team selection is requested before bracket generation."""


class AlreadyClaimedError(RuntimeError):
    """Raised when a participant already has a selected team."""


class TeamNotFoundError(LookupError):
    """Raised when a team is not part of the session's bracket."""


class TeamUnavailableError(RuntimeError):
    """Raised when a team is claimed or eliminated from the bracket."""


class TeamClaimConflictError(RuntimeError):
    """Raised when another participant claims a team concurrently."""
