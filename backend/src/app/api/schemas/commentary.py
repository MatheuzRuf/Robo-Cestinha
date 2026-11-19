"""API schemas for generated live-match commentary."""

from pydantic import BaseModel, Field


class CommentaryEventSchema(BaseModel):
    """Compact event context supplied to the commentary generator."""

    f: int
    ty: str
    p: str = ""
    tm: str = ""
    pts: int | None = None
    d: str | None = None


class CommentaryScoreSchema(BaseModel):
    """Current score at the requested frame."""

    h: int
    a: int


class CommentaryStatsSchema(BaseModel):
    """Cumulative statistics at the requested frame."""

    sc: CommentaryScoreSchema
    tf: dict[str, int]
    pp: dict[str, int]


class CommentarySnapshotSchema(BaseModel):
    """Recent events and current statistics for one simulation frame."""

    f: int = Field(ge=0)
    tf: int = Field(ge=1)
    ev: list[CommentaryEventSchema] = Field(max_length=40)
    st: CommentaryStatsSchema


class GenerateCommentaryBatchRequest(BaseModel):
    """Request payload for preloading commentary for a full simulation."""

    snapshots: list[CommentarySnapshotSchema] = Field(max_length=250)


class CommentaryFrameResponse(BaseModel):
    """Commentary associated with one simulation frame."""

    f: int
    c: str | None


class GenerateCommentaryBatchResponse(BaseModel):
    """Pre-generated commentary indexed by simulation frame."""

    commentaries: list[CommentaryFrameResponse]
