"""Das Titelbild je Art, klein.

Die Artenliste zeigt es rechts in der Zeile, dort wo bis D10 die Saisonkurve
stand. Es kommt aus der Datenbank, waehrend die Profile Dateien sind; darum
steht die Abfrage hier und nicht im Katalog.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SpeciesImage
from app.modules.species_images.schemas import Size, file_url
from app.shared.schemas import ImageState


async def lead_images(session: AsyncSession) -> dict[str, str]:
    """Der Pfad der kleinen Fassung je Art. Wer keins hat, steht nicht darin."""
    rows = (
        await session.execute(
            select(SpeciesImage.species_slug, SpeciesImage.id)
            .where(SpeciesImage.lead.is_(True))
            .where(SpeciesImage.state == ImageState.APPROVED)
        )
    ).all()
    return {str(slug): file_url(str(identifier), Size.THUMB) for slug, identifier in rows}
