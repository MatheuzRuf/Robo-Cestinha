from secrets import token_hex


def generate_session_hash() -> str:
    """Generate a short public session hash.

    The identifier is intended to be unique in practice, but it is not
    collision-proof; callers still rely on the database unique constraint.
    """

    return f"RC-{token_hex(2).upper()}-{token_hex(2).upper()}"
