import uuid

import pytest
from app.api.routers import bracket
from app.api.schemas.bracket import GenerateBracketRequest
from app.domain.bracket.service import (
    BracketAlreadyGeneratedError,
    BracketOwnerRequiredError,
)
from app.domain.sessions.service import SessionNotFoundError
from fastapi import HTTPException


class MockBracketService:
    async def get_bracket(self, session_hash: str, user_id: uuid.UUID):
        assert session_hash == "#RC-1234-CHI"
        assert user_id == OWNER_ID
        return {
            "generated": False,
            "can_generate": True,
            "rounds": [
                {
                    "round_number": 0,
                    "matches": [
                        {
                            "match_id": None,
                            "slot": 0,
                            "home_team": None,
                            "away_team": None,
                        }
                    ],
                }
            ],
        }

    async def generate_bracket(self, _session_hash: str, _user_id: uuid.UUID):
        return await self.get_bracket("#RC-1234-CHI", OWNER_ID)


class MockFactory:
    def bracket_service(self):
        return MockBracketService()


OWNER_ID = uuid.uuid4()


@pytest.mark.asyncio
async def test_get_bracket_returns_tree_response():
    response = await bracket.get_bracket("#RC-1234-CHI", OWNER_ID, MockFactory())

    assert response.generated is False
    assert response.can_generate is True
    assert response.rounds[0].matches[0].match_id is None


@pytest.mark.asyncio
async def test_generate_bracket_returns_tree_response():
    response = await bracket.generate_bracket(
        "#RC-1234-CHI", GenerateBracketRequest(user_id=OWNER_ID), MockFactory()
    )

    assert response.rounds[0].matches[0].slot == 0


@pytest.mark.asyncio
async def test_get_bracket_maps_missing_session_to_not_found():
    class MissingBracketService:
        async def get_bracket(self, _session_hash: str, _user_id: uuid.UUID):
            raise SessionNotFoundError

    class MissingFactory:
        def bracket_service(self):
            return MissingBracketService()

    with pytest.raises(HTTPException) as caught:
        await bracket.get_bracket("#RC-1234-CHI", OWNER_ID, MissingFactory())

    assert caught.value.status_code == 404
    assert caught.value.detail == "session_not_found"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("error", "status_code", "detail"),
    [
        (SessionNotFoundError, 404, "session_not_found"),
        (BracketOwnerRequiredError, 403, "session_owner_required"),
        (BracketAlreadyGeneratedError, 409, "bracket_already_generated"),
    ],
)
async def test_generate_bracket_maps_domain_errors(error, status_code, detail):
    class FailingBracketService:
        async def generate_bracket(self, _session_hash: str, _user_id: uuid.UUID):
            raise error

    class FailingFactory:
        def bracket_service(self):
            return FailingBracketService()

    with pytest.raises(HTTPException) as caught:
        await bracket.generate_bracket(
            "#RC-1234-CHI",
            GenerateBracketRequest(user_id=OWNER_ID),
            FailingFactory(),
        )

    assert caught.value.status_code == status_code
    assert caught.value.detail == detail
