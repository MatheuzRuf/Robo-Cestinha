from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import health, matches, sessions, teams
from app.core.config import settings

app = FastAPI(title="Robô Cestinha API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.api_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(teams.router, prefix="/team", tags=["teams"])
app.include_router(matches.router, prefix="/matches", tags=["matches"])
