import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class SessionParticipant:
    """A participant and their role in a session."""

    user_id: uuid.UUID
    user_name: str
    join_sequence: int
    is_owner: bool
