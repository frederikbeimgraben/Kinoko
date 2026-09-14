"""Sammelt die Router der vier Objektarten."""

from fastapi import APIRouter

from app.modules.objects import combinations, finds, markers, zones

router = APIRouter()
router.include_router(finds.router)
router.include_router(markers.router)
router.include_router(zones.router)
router.include_router(combinations.router)
