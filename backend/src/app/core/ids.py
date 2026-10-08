from secrets import choice, randbelow

SESSION_CODE_SUFFIXES = ("OAK", "TEX", "CHI", "SEA", "BKN", "MIA")


def generate_session_hash() -> str:
    """Generate a short public session hash.

    The code may collide; the database unique constraint remains the final guard.

    Returns:
        A code compatible with the frontend session-code format.
    """

    return f"#RC-{randbelow(9000) + 1000}-{choice(SESSION_CODE_SUFFIXES)}"
