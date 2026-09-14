"""Die Endpunkte des Moduls catalog: Arten, Bündel, Taxa, Begriffe."""

from fastapi import APIRouter

from app.modules.catalog import bundle, species, taxonomy, terms

router = APIRouter()
router.include_router(bundle.router)
router.include_router(species.router)
router.include_router(taxonomy.router)
router.include_router(terms.router)
