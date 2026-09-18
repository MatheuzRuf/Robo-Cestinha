from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """Declarative base for all SQLAlchemy models."""

    pass


engine = create_async_engine(settings.database_url)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    """Yield an async database session for a request.

    Yields:
        An open `AsyncSession` scoped to the caller.
    """

    async with AsyncSessionLocal() as session:
        yield session
