"""Baseline aller Tabellen."""

from collections.abc import Sequence
from typing import Final

import sqlalchemy as sa
from alembic import op

from app.models import Utc

revision: str = "baseline_3"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


DROP_ORDER: Final = (
    "species_colour_change_trigger",
    "species_colour",
    "pipeline_run_find",
    "photo",
    "zone",
    "species_trait",
    "species_term",
    "species_source",
    "species_season",
    "species_part_note",
    "species_part_feature",
    "species_name",
    "species_measurement",
    "species_lookalike",
    "species_colour_range",
    "species_colour_change",
    "pipeline_run_step",
    "pipeline_run_species",
    "marker",
    "group_member",
    "find",
    "user_role",
    "text",
    "species",
    "role_permission",
    "pipeline_run",
    "group",
    "glossary_entry",
    "combination",
    "user",
    "term",
    "taxon",
    "role",
    "permission",
)


def _first() -> None:
    """Der erste Teil der Tabellen."""
    op.create_table(
        "permission",
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("area", sa.String(length=20), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )

    op.create_table(
        "role",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("built_in", sa.Boolean(), nullable=False),
        sa.Column("created_at", Utc(), nullable=False),
        sa.Column("updated_at", Utc(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "taxon",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("rank", sa.String(length=20), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("latin_name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["parent_id"], ["taxon.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("taxon", schema=None) as batch_op:
        batch_op.create_index("ix_taxon_rank_slug", ["rank", "slug"], unique=True)

    op.create_table(
        "term",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("group_key", sa.String(length=20), nullable=True),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("term", schema=None) as batch_op:
        batch_op.create_index("ix_term_kind_slug", ["kind", "slug"], unique=True)

    op.create_table(
        "user",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("sub", sa.String(length=128), nullable=False),
        sa.Column("email", sa.String(length=120), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("created_at", Utc(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("user", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_user_sub"), ["sub"], unique=True)

    op.create_table(
        "combination",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("rule", sa.String(length=20), nullable=False),
        sa.Column("factors", sa.Text(), nullable=False),
        sa.Column("created_at", Utc(), nullable=False),
        sa.Column("updated_at", Utc(), nullable=False),
        sa.Column("deleted_at", Utc(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("combination", schema=None) as batch_op:
        batch_op.create_index(
            "ix_combination_owner_updated", ["owner_id", "updated_at"], unique=False
        )

    op.create_table(
        "glossary_entry",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("term", sa.String(length=120), nullable=False),
        sa.Column("definition", sa.Text(), nullable=False),
        sa.Column("updated_at", Utc(), nullable=False),
        sa.Column("updated_by_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["updated_by_id"], ["user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("term"),
    )

    op.create_table(
        "group",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("invite_code", sa.String(length=16), nullable=False),
        sa.Column("created_at", Utc(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("group", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_group_invite_code"), ["invite_code"], unique=True)

    op.create_table(
        "pipeline_run",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("state", sa.String(length=20), nullable=False),
        sa.Column("queued_at", Utc(), nullable=False),
        sa.Column("started_at", Utc(), nullable=True),
        sa.Column("finished_at", Utc(), nullable=True),
        sa.Column("log_path", sa.Text(), nullable=True),
        sa.Column("metric_brier", sa.Float(), nullable=True),
        sa.Column("progress_done", sa.Integer(), nullable=False),
        sa.Column("progress_total", sa.Integer(), nullable=False),
        sa.Column("triggered_by_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["triggered_by_id"], ["user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "role_permission",
        sa.Column("role_id", sa.Uuid(), nullable=False),
        sa.Column("permission_key", sa.String(length=80), nullable=False),
        sa.ForeignKeyConstraint(["permission_key"], ["permission.key"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["role.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("role_id", "permission_key"),
    )


def _second() -> None:
    """Der zweite Teil der Tabellen."""
    op.create_table(
        "species",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("latin_name", sa.String(length=120), nullable=False),
        sa.Column("taxon_id", sa.Uuid(), nullable=True),
        sa.Column("group_key", sa.String(length=40), nullable=False),
        sa.Column("edibility", sa.String(length=30), nullable=False),
        sa.Column("marketable", sa.Boolean(), nullable=False),
        sa.Column("forecast_enabled", sa.Boolean(), nullable=False),
        sa.Column("frequency", sa.String(length=20), nullable=True),
        sa.Column("red_list", sa.String(length=30), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("edibility_note", sa.Text(), nullable=True),
        sa.Column("protection", sa.String(length=20), nullable=False),
        sa.Column("protection_note", sa.Text(), nullable=True),
        sa.Column("period_start_month", sa.Integer(), nullable=True),
        sa.Column("period_end_month", sa.Integer(), nullable=True),
        sa.Column("period_peak_month", sa.Integer(), nullable=True),
        sa.Column("smell_text", sa.Text(), nullable=True),
        sa.Column("taste_text", sa.Text(), nullable=True),
        sa.Column("hymenium_type", sa.String(length=20), nullable=True),
        sa.Column("gill_attachment", sa.String(length=20), nullable=True),
        sa.Column("gill_spacing", sa.String(length=20), nullable=True),
        sa.Column("gill_edge", sa.String(length=20), nullable=True),
        sa.Column("cap_shape_young", sa.String(length=20), nullable=True),
        sa.Column("cap_shape_old", sa.String(length=20), nullable=True),
        sa.Column("updated_at", Utc(), nullable=False),
        sa.Column("updated_by_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["taxon_id"], ["taxon.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by_id"], ["user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("latin_name"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "text",
        sa.Column("key", sa.String(length=120), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("updated_at", Utc(), nullable=False),
        sa.Column("updated_by_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["updated_by_id"], ["user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("key", "locale"),
    )

    op.create_table(
        "user_role",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role_id", sa.Uuid(), nullable=False),
        sa.Column("granted_at", Utc(), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["role.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "role_id"),
    )

    op.create_table(
        "find",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("species_id", sa.Uuid(), nullable=True),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("found_on", sa.Date(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=True),
        sa.Column("for_training", sa.Boolean(), nullable=False),
        sa.Column("review_state", sa.String(length=20), nullable=False),
        sa.Column("reviewed_by_id", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", Utc(), nullable=True),
        sa.Column("visibility", sa.String(length=20), nullable=False),
        sa.Column("group_id", sa.Uuid(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", Utc(), nullable=False),
        sa.Column("updated_at", Utc(), nullable=False),
        sa.Column("deleted_at", Utc(), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["group.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["user.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["species_id"], ["species.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("find", schema=None) as batch_op:
        batch_op.create_index("ix_find_owner_updated", ["owner_id", "updated_at"], unique=False)

    op.create_table(
        "group_member",
        sa.Column("group_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("joined_at", Utc(), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["group.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("group_id", "user_id"),
    )

    op.create_table(
        "marker",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("colour", sa.String(length=20), nullable=False),
        sa.Column("visibility", sa.String(length=20), nullable=False),
        sa.Column("group_id", sa.Uuid(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", Utc(), nullable=False),
        sa.Column("updated_at", Utc(), nullable=False),
        sa.Column("deleted_at", Utc(), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["group.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("marker", schema=None) as batch_op:
        batch_op.create_index("ix_marker_owner_updated", ["owner_id", "updated_at"], unique=False)

    op.create_table(
        "pipeline_run_species",
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("species_id", sa.Uuid(), nullable=False),
        sa.Column("state", sa.String(length=20), nullable=False),
        sa.Column("record_count", sa.Integer(), nullable=False),
        sa.Column("find_count", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["pipeline_run.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["species_id"], ["species.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("run_id", "species_id"),
    )

    op.create_table(
        "pipeline_run_step",
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("state", sa.String(length=20), nullable=False),
        sa.Column("duration_s", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["run_id"], ["pipeline_run.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("run_id", "position"),
    )

    op.create_table(
        "species_colour_change",
        sa.Column("species_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("part", sa.String(length=20), nullable=False),
        sa.Column("from_name", sa.String(length=120), nullable=True),
        sa.Column("from_hex", sa.String(length=7), nullable=True),
        sa.Column("to_name", sa.String(length=120), nullable=False),
        sa.Column("to_hex", sa.String(length=7), nullable=False),
        sa.Column("speed", sa.String(length=20), nullable=True),
        sa.ForeignKeyConstraint(["species_id"], ["species.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("species_id", "position"),
    )

    op.create_table(
        "species_colour_range",
        sa.Column("species_id", sa.Uuid(), nullable=False),
        sa.Column("part", sa.String(length=20), nullable=False),
        sa.Column("mode", sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(["species_id"], ["species.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("species_id", "part"),
    )

    op.create_table(
        "species_lookalike",
        sa.Column("species_a_id", sa.Uuid(), nullable=False),
        sa.Column("species_b_id", sa.Uuid(), nullable=False),
        sa.Column("difference_a", sa.Text(), nullable=True),
        sa.Column("difference_b", sa.Text(), nullable=True),
        sa.CheckConstraint("species_a_id < species_b_id", name="ck_lookalike_order"),
        sa.ForeignKeyConstraint(["species_a_id"], ["species.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["species_b_id"], ["species.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("species_a_id", "species_b_id"),
    )

    op.create_table(
        "species_measurement",
        sa.Column("species_id", sa.Uuid(), nullable=False),
        sa.Column("part", sa.String(length=20), nullable=False),
        sa.Column("dimension", sa.String(length=20), nullable=False),
        sa.Column("low", sa.Float(), nullable=False),
        sa.Column("high", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=10), nullable=False),
        sa.ForeignKeyConstraint(["species_id"], ["species.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("species_id", "part", "dimension"),
    )

    op.create_table(
        "species_name",
        sa.Column("species_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(["species_id"], ["species.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("species_id", "position"),
    )


def _third() -> None:
    """Der dritte Teil der Tabellen."""
    op.create_table(
        "species_part_feature",
        sa.Column("species_id", sa.Uuid(), nullable=False),
        sa.Column("part", sa.String(length=20), nullable=False),
        sa.Column("feature", sa.String(length=30), nullable=False),
        sa.Column("phase", sa.String(length=10), nullable=False),
        sa.ForeignKeyConstraint(["species_id"], ["species.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("species_id", "part", "feature", "phase"),
    )

    op.create_table(
        "species_part_note",
        sa.Column("species_id", sa.Uuid(), nullable=False),
        sa.Column("part", sa.String(length=20), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["species_id"], ["species.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("species_id", "part"),
    )

    op.create_table(
        "species_season",
        sa.Column("species_id", sa.Uuid(), nullable=False),
        sa.Column("season", sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(["species_id"], ["species.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("species_id", "season"),
    )

    op.create_table(
        "species_source",
        sa.Column("species_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("scope", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("checked_on", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(["species_id"], ["species.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("species_id", "position"),
    )

    op.create_table(
        "species_term",
        sa.Column("species_id", sa.Uuid(), nullable=False),
        sa.Column("term_id", sa.Uuid(), nullable=False),
        sa.Column("from_experience", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["species_id"], ["species.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["term_id"], ["term.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("species_id", "term_id"),
    )

    op.create_table(
        "species_trait",
        sa.Column("species_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.String(length=30), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["species_id"], ["species.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("species_id", "key"),
    )

    op.create_table(
        "zone",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("polygon", sa.Text(), nullable=False),
        sa.Column("area_ha", sa.Float(), nullable=False),
        sa.Column("colour", sa.String(length=20), nullable=False),
        sa.Column("visibility", sa.String(length=20), nullable=False),
        sa.Column("group_id", sa.Uuid(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", Utc(), nullable=False),
        sa.Column("updated_at", Utc(), nullable=False),
        sa.Column("deleted_at", Utc(), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["group.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("zone", schema=None) as batch_op:
        batch_op.create_index("ix_zone_owner_updated", ["owner_id", "updated_at"], unique=False)

    op.create_table(
        "photo",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("find_id", sa.Uuid(), nullable=True),
        sa.Column("species_id", sa.Uuid(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("photographer", sa.String(length=120), nullable=False),
        sa.Column("licence", sa.String(length=20), nullable=False),
        sa.Column("source", sa.Text(), nullable=True),
        sa.Column("taken_on", sa.Date(), nullable=True),
        sa.Column("caption", sa.String(length=200), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
        sa.Column("lead", sa.Boolean(), nullable=False),
        sa.Column("state", sa.String(length=20), nullable=False),
        sa.Column("reject_reason", sa.String(length=200), nullable=True),
        sa.Column("reviewed_by_id", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", Utc(), nullable=True),
        sa.Column("created_at", Utc(), nullable=False),
        sa.Column("updated_at", Utc(), nullable=False),
        sa.ForeignKeyConstraint(["find_id"], ["find.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["user.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["species_id"], ["species.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("photo", schema=None) as batch_op:
        batch_op.create_index("ix_photo_species_state", ["species_id", "state"], unique=False)

    op.create_table(
        "pipeline_run_find",
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("find_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["find_id"], ["find.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["pipeline_run.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("run_id", "find_id"),
    )

    op.create_table(
        "species_colour",
        sa.Column("species_id", sa.Uuid(), nullable=False),
        sa.Column("part", sa.String(length=20), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("hex", sa.String(length=7), nullable=False),
        sa.ForeignKeyConstraint(
            ["species_id", "part"],
            ["species_colour_range.species_id", "species_colour_range.part"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("species_id", "part", "position"),
    )

    op.create_table(
        "species_colour_change_trigger",
        sa.Column("species_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("term_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["species_id", "position"],
            ["species_colour_change.species_id", "species_colour_change.position"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["term_id"], ["term.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("species_id", "position", "term_id"),
    )


def upgrade() -> None:
    """Legt alle Tabellen an."""
    _first()
    _second()
    _third()


def downgrade() -> None:
    """Löscht alle Tabellen."""
    for table in DROP_ORDER:
        op.drop_table(table)
