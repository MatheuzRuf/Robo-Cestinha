from sqlalchemy.ext.asyncio import AsyncSession


class BaseRepository:
    """Provide common persistence operations for domain repositories."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the repository with a request-scoped database session.

        Args:
            db: Active async database session.
        """

        self._db = db

    async def add(self, entity: object) -> None:
        """Stage an entity in the current transaction.

        Args:
            entity: Entity to add.
        """

        self._db.add(entity)

    async def add_all(self, entities: list[object]) -> None:
        """Stage multiple entities in the current transaction.

        Args:
            entities: Entities to add.
        """

        self._db.add_all(entities)

    async def flush(self) -> None:
        """Flush pending changes to the database without committing."""

        await self._db.flush()

    async def commit(self) -> None:
        """Commit the current transaction."""

        await self._db.commit()

    async def refresh(self, entity: object) -> None:
        """Refresh an entity from the database.

        Args:
            entity: Persisted entity to refresh.
        """

        await self._db.refresh(entity)
