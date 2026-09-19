"""Wer ruft, und was darf er."""

from __future__ import annotations

import uuid
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Annotated, Any, Final

import jwt
from fastapi import Depends, Header
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import session
from app.core.errors import Forbidden, Unauthorized
from app.core.jwks import cache, groups_of
from app.core.settings import get_settings
from app.models import Permission, Role, RolePermission, User, UserRole
from app.modules.access.permissions import BASE_ROLE
from app.modules.access.service import AccessService

BEARER: Final = "Bearer "

# Die Uhren von Issuer und Server laufen nicht gleich. Ohne Spielraum wird ein
# frisches Token an der Grenze abgelehnt, und die App meldet ab.
CLOCK_TOLERANCE: Final = 60.0

Db = Annotated[AsyncSession, Depends(session)]


@dataclass(frozen=True, slots=True)
class Viewer:
    """Das Konto der Anfrage, seine Rechte und die Ansprüche des Tokens."""

    user: User | None
    rights: frozenset[str]
    claims: Mapping[str, Any] = field(default_factory=dict[str, Any])

    @property
    def sub(self) -> str:
        """Die Kennung des Kontos im SSO."""
        return str(self.claims.get("sub", ""))

    @property
    def signed_in(self) -> bool:
        """Sagt, ob ein Konto hinter der Anfrage steht."""
        return self.user is not None

    def may(self, permission: str) -> bool:
        """Sagt, ob das Konto ein Recht hat."""
        return permission in self.rights

    def owns(self, owner_id: uuid.UUID | None) -> bool:
        """Sagt, ob das Konto Eigentümer ist."""
        return self.user is not None and owner_id == self.user.id


def bearer(header: str | None) -> str | None:
    """Zieht das Token aus der Kopfzeile."""
    if header and header.startswith(BEARER):
        return header.removeprefix(BEARER).strip() or None
    return None


async def claims_of(token: str) -> dict[str, Any]:
    """Prüft das Token gegen den Issuer und liefert seine Ansprüche."""
    settings = get_settings()
    try:
        kid = jwt.get_unverified_header(token).get("kid")
    except jwt.PyJWTError as broken:
        raise Unauthorized from broken
    if not isinstance(kid, str):
        raise Unauthorized
    key = await cache().key(kid)
    if key is None:
        raise Unauthorized
    try:
        return jwt.decode(
            token,
            key=key,
            algorithms=["RS256", "ES256"],
            audience=settings.oidc_client_id,
            issuer=settings.oidc_issuer,
            leeway=CLOCK_TOLERANCE,
        )
    except jwt.PyJWTError as broken:
        raise Unauthorized from broken


async def person_of(db: AsyncSession, sub: str) -> User | None:
    """Liest das Konto zu einer Kennung, ohne es anzulegen."""
    return (await db.execute(select(User).where(User.sub == sub))).scalar_one_or_none()


async def rights_of(
    db: AsyncSession, user: User | None, claims: Mapping[str, Any], token: str
) -> frozenset[str]:
    """Liest die Rechte des Kontos. Admin-Gruppe und Rolle `user` gelten immer."""
    groups = await groups_of(token, claims) or []
    if get_settings().admin_group in groups:
        keys = await db.execute(select(Permission.key))
        return frozenset(keys.scalars())
    if user is None:
        return frozenset()
    assigned = select(UserRole.role_id).where(UserRole.user_id == user.id)
    query = (
        select(RolePermission.permission_key)
        .join(Role, Role.id == RolePermission.role_id)
        .where(or_(Role.id.in_(assigned), Role.slug == BASE_ROLE))
    )
    return frozenset((await db.execute(query)).scalars())


async def viewer(
    db: Db,
    authorization: Annotated[str | None, Header()] = None,
) -> Viewer:
    """Dependency: der Aufrufer, auch ohne Anmeldung. Sie schreibt nicht."""
    token = bearer(authorization)
    if token is None:
        return Viewer(None, frozenset())
    claims = await claims_of(token)
    if not str(claims.get("sub", "")):
        raise Unauthorized
    user = await person_of(db, str(claims["sub"]))
    return Viewer(user, await rights_of(db, user, claims, token), claims)


async def optional_user(who: Annotated[Viewer, Depends(viewer)]) -> User | None:
    """Dependency: das Konto, falls eines da ist."""
    return who.user


async def current_user(db: Db, who: Annotated[Viewer, Depends(viewer)]) -> User:
    """Dependency: das angemeldete Konto. Der Dienst legt es beim ersten Mal an."""
    if not who.sub:
        raise Unauthorized
    return await AccessService(db).ensure_person(who)


def requires(permission: str) -> Any:  # noqa: ANN401
    """Baut eine Dependency, die ein Recht verlangt."""

    async def guard(who: Annotated[Viewer, Depends(viewer)]) -> Viewer:
        if not who.sub:
            raise Unauthorized
        if not who.may(permission):
            raise Forbidden
        return who

    return Depends(guard)


CurrentUser = Annotated[User, Depends(current_user)]
OptionalUser = Annotated[User | None, Depends(optional_user)]
CurrentViewer = Annotated[Viewer, Depends(viewer)]
