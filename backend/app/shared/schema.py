"""Die Grundform aller Schemata: camelCase nach außen, snake_case im Code."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any

from pydantic import AfterValidator, BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


def _with_timezone(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


Timestamp = Annotated[datetime, AfterValidator(_with_timezone)]


class Schema(BaseModel):
    """Basis jedes Schemas der Schnittstelle."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        ser_json_timedelta="iso8601",
    )

    def dumped(self) -> dict[str, Any]:
        """Das Schema als Abbildung mit den Namen des Vertrags."""
        return self.model_dump(by_alias=True, mode="json")
