"""Die Endpunkte der Läufe und die internen Endpunkte der Kette."""

from fastapi import APIRouter

router = APIRouter(tags=["pipeline-runs"])
internal_router = APIRouter(tags=["internal"])
