from secrets import token_hex


def generate_session_hash() -> str:
    return f"RC-{token_hex(2).upper()}-{token_hex(2).upper()}"
