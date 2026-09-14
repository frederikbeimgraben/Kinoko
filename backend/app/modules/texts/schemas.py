"""Die Schemata des Textkatalogs."""

from __future__ import annotations

from pydantic import Field

from app.shared.schema import Schema


class TextWrite(Schema):
    """Ein geänderter Text."""

    locale: str
    value: str = Field(min_length=1, max_length=2000)
