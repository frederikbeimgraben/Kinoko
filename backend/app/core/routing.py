"""Zwei Regeln für jede Route: erlaubte Methoden und bekannte Parameter."""

from __future__ import annotations

from fastapi import Request
from fastapi.dependencies.models import Dependant
from fastapi.routing import APIRoute
from starlette.exceptions import HTTPException

from app.core.errors import Invalid, allowed_methods

NOT_ALLOWED = 405

BRACKET = "["


def declared_names(dependant: Dependant) -> set[str]:
    """Die Namen der Abfrageparameter, auch aus den Unterabhängigkeiten."""
    found = {field.alias for field in dependant.query_params}
    for child in dependant.dependencies:
        found |= declared_names(child)
    return found


async def reject_unknown_method(request: Request) -> None:
    """Weist eine Methode zurück, die der Vertrag für den Pfad nicht führt."""
    allowed = allowed_methods(request.app, request.url.path)
    if allowed and request.method not in allowed:
        raise HTTPException(NOT_ALLOWED, headers={"Allow": ", ".join(allowed)})


async def reject_unknown_query(request: Request) -> None:
    """Weist einen Abfrageparameter zurück, den die Route nicht kennt."""
    route = request.scope.get("route")
    if not isinstance(route, APIRoute):
        return
    known = declared_names(route.dependant)
    unknown = [key for key in request.query_params if BRACKET not in key and key not in known]
    if unknown:
        raise Invalid(errors=[{"field": key, "code": "unknown"} for key in unknown])
