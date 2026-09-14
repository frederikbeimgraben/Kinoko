"""Fehler als Problemdokument nach RFC 9457."""

from __future__ import annotations

import re
from http import HTTPStatus
from typing import TYPE_CHECKING, Any, Final, cast

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence

VERBS: Final = frozenset({"get", "post", "put", "patch", "delete"})
MEDIA_TYPE: Final = "application/problem+json"
TYPE_PREFIX: Final = "urn:primordium:error:"
FALLBACK_LOCALE: Final = "de"

_titles: dict[str, str] = {}


def title_key(code: str) -> str:
    """Der Textschlüssel zum Fehlercode, etwa ``not_found`` zu ``error.notFound``."""
    head, *rest = code.split("_")
    return "error." + head + "".join(part.capitalize() for part in rest)


def set_titles(titles: Mapping[str, str]) -> None:
    """Setzt die Titel der Fehler aus dem Textkatalog."""
    _titles.clear()
    _titles.update(titles)


def title_of(code: str) -> str:
    """Liefert den Titel eines Fehlercodes, ohne Katalog den Code selbst."""
    return _titles.get(title_key(code), code)


class AppError(Exception):
    """Ein Fehler, den die Anwendung als Problemdokument abgibt."""

    def __init__(
        self,
        code: str,
        status: int,
        detail: str | None = None,
        errors: Sequence[Mapping[str, str]] | None = None,
    ) -> None:
        super().__init__(code)
        self.code = code
        self.status = status
        self.detail = detail
        self.errors = list(errors or [])


class NotFound(AppError):
    """Die Zeile gibt es nicht, oder sie gehört jemand anderem."""

    def __init__(self, detail: str | None = None) -> None:
        super().__init__("not_found", HTTPStatus.NOT_FOUND, detail)


class Unauthorized(AppError):
    """Ohne gültiges Token."""

    def __init__(self, detail: str | None = None) -> None:
        super().__init__("unauthorized", HTTPStatus.UNAUTHORIZED, detail)


class Forbidden(AppError):
    """Mit Token, aber ohne das nötige Recht."""

    def __init__(self, detail: str | None = None) -> None:
        super().__init__("forbidden", HTTPStatus.FORBIDDEN, detail)


class Conflict(AppError):
    """Der Vorgang widerspricht dem Bestand."""

    def __init__(self, code: str = "conflict", detail: str | None = None) -> None:
        super().__init__(code, HTTPStatus.CONFLICT, detail)


class TooLarge(AppError):
    """Der Körper der Anfrage ist zu groß."""

    def __init__(self, detail: str | None = None) -> None:
        super().__init__("too_large", HTTPStatus.REQUEST_ENTITY_TOO_LARGE, detail)


class Invalid(AppError):
    """Die Eingabe passt nicht zum Vertrag."""

    def __init__(
        self,
        detail: str | None = None,
        errors: Sequence[Mapping[str, str]] | None = None,
    ) -> None:
        super().__init__("validation", HTTPStatus.UNPROCESSABLE_ENTITY, detail, errors)


def document(error: AppError) -> dict[str, Any]:
    """Baut das Problemdokument zu einem Fehler."""
    body: dict[str, Any] = {
        "type": TYPE_PREFIX + error.code,
        "title": title_of(error.code),
        "status": error.status,
        "code": error.code,
    }
    if error.detail:
        body["detail"] = error.detail
    if error.errors:
        body["errors"] = error.errors
    return body


def problem_response(
    error: AppError,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    """Antwortet mit dem Problemdokument."""
    return JSONResponse(
        document(error),
        status_code=error.status,
        media_type=MEDIA_TYPE,
        headers=dict(headers) if headers else None,
    )


def field_errors(exception: RequestValidationError) -> list[dict[str, str]]:
    """Übersetzt die Meldungen von Pydantic in Feld und Code."""
    found: list[dict[str, str]] = []
    for item in exception.errors():
        parts = [str(part) for part in item["loc"] if part not in {"body", "query", "path"}]
        found.append({"field": ".".join(parts) or "body", "code": str(item["type"])})
    return found


CODES: Final[dict[int, str]] = {
    HTTPStatus.UNAUTHORIZED: "unauthorized",
    HTTPStatus.FORBIDDEN: "forbidden",
    HTTPStatus.NOT_FOUND: "not_found",
    HTTPStatus.METHOD_NOT_ALLOWED: "method_not_allowed",
    HTTPStatus.CONFLICT: "conflict",
    HTTPStatus.REQUEST_ENTITY_TOO_LARGE: "too_large",
    HTTPStatus.UNSUPPORTED_MEDIA_TYPE: "unsupported_media",
    HTTPStatus.UNPROCESSABLE_ENTITY: "validation",
}


PARAMETER: Final = re.compile(r"\{[^}]+\}")
INDEX_KEY: Final = "_method_index"


def method_index(app: FastAPI) -> list[tuple[re.Pattern[str], int, set[str]]]:
    """Ein Muster je Pfad des Schemas, mit Rang und Methoden."""
    found = getattr(app.state, INDEX_KEY, None)
    if found is not None:
        return cast("list[tuple[re.Pattern[str], int, set[str]]]", found)
    built: list[tuple[re.Pattern[str], int, set[str]]] = []
    for path, item in app.openapi()["paths"].items():
        escaped = re.escape(path).replace("\\{", "{").replace("\\}", "}")
        pattern = re.compile("^" + PARAMETER.sub("[^/]+", escaped) + "$")
        rank = sum(1 for part in path.split("/") if part and not part.startswith("{"))
        methods = {method.upper() for method in item if method in VERBS}
        if "GET" in methods:
            methods.add("HEAD")
        built.append((pattern, rank, methods))
    setattr(app.state, INDEX_KEY, built)
    return built


def allowed_methods(app: FastAPI, path: str) -> list[str]:
    """Die Methoden des Pfads, der am genauesten passt."""
    hits = [(rank, methods) for pattern, rank, methods in method_index(app) if pattern.match(path)]
    if not hits:
        return []
    best = max(rank for rank, _ in hits)
    found: set[str] = set()
    for rank, methods in hits:
        if rank == best:
            found |= methods
    return sorted(found)


def register_error_handlers(built: FastAPI) -> None:
    """Hängt die Fehlerbehandlung an die App."""

    async def on_app_error(_: Request, exception: Exception) -> JSONResponse:
        return problem_response(
            exception if isinstance(exception, AppError) else AppError("internal", 500)
        )

    async def on_validation(_: Request, exception: Exception) -> JSONResponse:
        found = field_errors(exception) if isinstance(exception, RequestValidationError) else []
        return problem_response(Invalid(errors=found))

    async def on_http(request: Request, exception: Exception) -> JSONResponse:
        if not isinstance(exception, HTTPException):
            return problem_response(AppError("internal", 500))
        code = CODES.get(exception.status_code, "internal")
        error = AppError(code, exception.status_code)
        headers = dict(exception.headers or {})
        if exception.status_code == HTTPStatus.METHOD_NOT_ALLOWED:
            found = allowed_methods(request.app, request.url.path)
            if found:
                headers["Allow"] = ", ".join(found)
        return problem_response(error, headers)

    built.add_exception_handler(AppError, on_app_error)
    built.add_exception_handler(RequestValidationError, on_validation)
    built.add_exception_handler(HTTPException, on_http)
