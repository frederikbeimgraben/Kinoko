"""Die FastAPI-App. Der Dienst startet sie als ``uvicorn app.main:app``."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import engine, session_factory
from app.core.errors import register_error_handlers
from app.core.routing import reject_unknown_method, reject_unknown_query
from app.core.settings import VERSION, get_settings
from app.modules import system
from app.modules.access import router as access_router
from app.modules.access import seed as access_seed
from app.modules.catalog import router as catalog_router
from app.modules.catalog import seed as catalog_seed
from app.modules.objects import router as objects_router
from app.modules.photos import router as photos_router
from app.modules.pipeline import router as pipeline_router
from app.modules.texts import router as texts_router
from app.modules.texts.seed import TextSeed
from app.modules.texts.service import TextService


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    """Importiert den Katalog bei Bedarf, gleicht Rechte, Rollen und Texte ab."""
    async with session_factory()() as db:
        await catalog_seed.sync(db)
        await access_seed.sync(db)
        await TextSeed().sync(db)
        await TextService(db).load_titles()
    yield
    await engine().dispose()


def build_app() -> FastAPI:
    """Baut die App: Router, Fehlerbehandlung, CORS."""
    settings = get_settings()
    built = FastAPI(
        title="Primordium",
        version=VERSION,
        lifespan=lifespan,
        dependencies=[Depends(reject_unknown_method), Depends(reject_unknown_query)],
    )
    built.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for module in (
        system.router,
        access_router.router,
        catalog_router.router,
        objects_router.router,
        photos_router.router,
        texts_router.router,
        pipeline_router.router,
        pipeline_router.internal_router,
    ):
        built.include_router(module, prefix="/api")
    register_error_handlers(built)
    return built


app = build_app()
