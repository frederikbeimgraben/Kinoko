"""Der gebaute Katalog je ETag, einmal im Speicher des Prozesses."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable


class BundleCache:
    """Hält die fertige Antwort zu einem ETag. Ein neuer ETag baut sie neu."""

    def __init__(self) -> None:
        self._gate = asyncio.Lock()
        self._tag: str | None = None
        self._body: bytes | None = None
        self.builds = 0

    async def body(self, tag: str, build: Callable[[], Awaitable[bytes]]) -> bytes:
        """Liefert die Antwort zum ETag und baut sie höchstens einmal."""
        known = self._hit(tag)
        if known is not None:
            return known
        async with self._gate:
            # Wer hinter dem Tor wartet, findet den Stand des ersten Bauers vor.
            known = self._hit(tag)
            if known is not None:
                return known
            body = await build()
            self._tag = tag
            self._body = body
            self.builds += 1
            return body

    def forget(self) -> None:
        """Wirft den Stand weg. Das Tor gehört danach der nächsten Schleife."""
        self._gate = asyncio.Lock()
        self._tag = None
        self._body = None
        self.builds = 0

    def _hit(self, tag: str) -> bytes | None:
        return self._body if self._tag == tag else None
