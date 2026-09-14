"""Gemeinsame Vorrichtungen der Tests."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator, Iterator
from typing import TYPE_CHECKING, Any

import httpx
import pytest
from fastapi import FastAPI

from app.core import auth, db
from app.core.auth import Viewer
from app.core.settings import get_settings
from app.main import build_app
from app.models import Base, User
from app.modules.access import seed as access_seed
from app.modules.texts import service as texts_service

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

ISSUER = "https://sso.example.test/application/o/pilze/"
CLIENT_ID = "pilze"


@pytest.fixture(autouse=True)
def environment(monkeypatch: pytest.MonkeyPatch, tmp_path: Any) -> Iterator[None]:  # noqa: ANN401
    """Setzt PILZE_* auf Testwerte und leert die Zwischenspeicher des Prozesses."""
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{tmp_path}/pilze.sqlite")
    monkeypatch.setenv("PILZE_FOTOS", str(tmp_path / "fotos"))
    monkeypatch.setenv("PILZE_MAPS", str(tmp_path / "maps"))
    monkeypatch.setenv("PILZE_OIDC_ISSUER", ISSUER)
    monkeypatch.setenv("PILZE_OIDC_CLIENT_ID", CLIENT_ID)
    monkeypatch.setenv("PILZE_ORIGIN", "http://localhost:4200")
    monkeypatch.setenv("PILZE_INTERNAL_TOKEN", "geheim")
    get_settings.cache_clear()
    db.engine.cache_clear()
    db.session_factory.cache_clear()
    yield
    get_settings.cache_clear()
    db.engine.cache_clear()
    db.session_factory.cache_clear()


@pytest.fixture
async def schema() -> AsyncIterator[None]:
    """Legt die Tabellen in der Datei des Tests an."""
    made = db.engine()
    async with made.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield
    await made.dispose()


@pytest.fixture
async def session(schema: None) -> AsyncIterator[AsyncSession]:  # noqa: ARG001
    """Eine offene Sitzung auf die Datenbank des Tests."""
    async with db.session_factory()() as open_one:
        yield open_one


@pytest.fixture
async def seeded(session: AsyncSession) -> None:
    """Rechte, Rollen und Texte, so wie der Start sie schreibt."""
    await access_seed.sync(session)
    await texts_service.sync(session)
    await texts_service.load_titles(session)


@pytest.fixture
async def api(seeded: None) -> AsyncIterator[httpx.AsyncClient]:  # noqa: ARG001
    """Ein Klient gegen die App, ohne Netz und ohne Anmeldung."""
    built = build_app()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=built),
        base_url="http://test/api",
    ) as client:
        client.app = built  # type: ignore[attr-defined]
        yield client


async def make_user(session: AsyncSession, sub: str = "person-1") -> User:
    """Legt ein Konto an."""
    made = User(id=uuid.uuid4(), sub=sub, email=f"{sub}@example.test", name=sub)
    session.add(made)
    await session.commit()
    return made


def sign_in(built: FastAPI, user: User, *rights: str) -> None:
    """Lässt jede Anfrage als dieses Konto laufen."""
    viewer = Viewer(user, frozenset(rights))
    built.dependency_overrides[auth.viewer] = lambda: viewer


def sign_out(built: FastAPI) -> None:
    """Nimmt die Anmeldung zurück."""
    built.dependency_overrides.pop(auth.viewer, None)


def app_of(client: httpx.AsyncClient) -> FastAPI:
    """Die App hinter einem Klienten."""
    return client.app  # type: ignore[attr-defined,no-any-return]
