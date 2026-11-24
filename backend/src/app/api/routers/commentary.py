"""Commentary generation endpoint."""

from fastapi import APIRouter

from app.api.schemas.commentary import (
    CommentaryFrameResponse,
    GenerateCommentaryBatchRequest,
    GenerateCommentaryBatchResponse,
)
from app.domain.commentary.service import CommentaryService

router = APIRouter()


@router.post("/batch", response_model=GenerateCommentaryBatchResponse)
async def generate_commentary_batch(
    payload: GenerateCommentaryBatchRequest,
) -> GenerateCommentaryBatchResponse:
    """Pre-generate commentary for a match in batches of ten snapshots.

    Args:
        payload: Ordered list of frame-indexed snapshots.

    Returns:
        Commentary results associated with their simulation frames.
    """

    snapshots = [
        snapshot.model_dump(exclude_none=True) for snapshot in payload.snapshots
    ]
    commentary = await CommentaryService().generate_batch(
        snapshots, payload.recent_commentary
    )
    return GenerateCommentaryBatchResponse(
        commentaries=[
            CommentaryFrameResponse(f=result["f"], c=result["c"])
            for result in commentary
        ]
    )
