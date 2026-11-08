from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import bracket, health, matches, sessions, teams
from app.core.config import settings

app = FastAPI(title="Robô Cestinha API")

# Vite picks a different port whenever 5173 is already taken (e.g. two dev
# instances running at once), so enumerating exact origins is fragile. Allow any
# loopback origin (any host alias and any port) while still requiring the exact
# application origins for non-loopback hosts.
_LOOPBACK_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.api_cors_origins,
    allow_origin_regex=_LOOPBACK_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(bracket.router, prefix="/bracket", tags=["bracket"])
app.include_router(teams.router, prefix="/team", tags=["teams"])
app.include_router(matches.router, prefix="/matches", tags=["matches"])
