import random
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ids import generate_session_hash
from app.db.models import Session, Team, User
from app.domain.bracket.service import seed_bracket


async def create_session(db: AsyncSession, owner_name: str, num_teams: int = 8) -> tuple[Session, User]:
    """Create a new session, owner user, and seeded bracket.

    Args:
        db: Active async database session.
        owner_name: Display name for the session owner.
        num_teams: Number of catalog teams to seed into the bracket.

    Returns:
        The created session and owner user.

    Raises:
        ValueError: If the catalog does not contain enough teams.
    """

    session = Session(id=uuid.uuid4(), hash=generate_session_hash())
    db.add(session)
    await db.flush()

    owner = User(
        id=uuid.uuid4(),
        session_id=session.id,
        join_sequence=1,
        name=owner_name,
    )
    db.add(owner)
    await db.flush()

    session.owner_id = owner.id

    result = await db.execute(select(Team.id))
    all_team_ids = [row[0] for row in result.all()]
    if len(all_team_ids) < num_teams:
        raise ValueError(
            f"Not enough teams in catalog ({len(all_team_ids)}) to seed a {num_teams}-team bracket. "
            f"Run the Spec 03 seed script first."
        )

    chosen = random.sample(all_team_ids, num_teams)
    await seed_bracket(db, session.id, chosen)

    await db.commit()
    await db.refresh(session)
    return session, owner
