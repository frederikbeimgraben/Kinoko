"""Das älteste freigegebene Bild wird Titelbild, wo noch keins ist.

Revision ID: c2d8e5f14a07
Revises: f3b7c92e480d
"""

from collections.abc import Sequence

from alembic import op

revision: str = "c2d8e5f14a07"
down_revision: str | None = "f3b7c92e480d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Seit bfc0a0f wird das erste freigegebene Bild einer Art beim Hochladen und
# beim Freigeben ihr Titelbild. Bilder von davor tragen die Marke nicht, und
# die Artenliste zeigt sie darum nicht. Diese Wanderung holt das einmal nach.
FIRST_LEAD = """
UPDATE species_image
SET lead = 1
WHERE state = 'approved'
  AND id = (
    SELECT i.id
    FROM species_image AS i
    WHERE i.species_slug = species_image.species_slug
      AND i.state = 'approved'
    ORDER BY i.created_at, i.id
    LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1
    FROM species_image AS l
    WHERE l.species_slug = species_image.species_slug
      AND l.state = 'approved'
      AND l.lead = 1
  )
"""


def upgrade() -> None:
    op.execute(FIRST_LEAD)


def downgrade() -> None:
    # Welche Marke von Hand kam und welche von hier, lässt sich hinterher
    # nicht mehr unterscheiden. Ein Rückschritt lässt sie darum stehen; ein
    # gesetztes Titelbild schadet dem alten Stand nicht.
    pass
