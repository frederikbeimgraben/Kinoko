"""Wer ruft, und was darf er."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated, Any, Final, cast

import jwt
from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import session
from app.core.errors import Forbidden, Unauthorized
from app.core.jwks import cache
from app.core.settings import get_settings
from app.models import Permission, Role, RolePermission, User, UserRole

BEARER: Final = "Bearer "
GROUP_CLAIM: Final = "groups"

Db = Annotated[AsyncSession, Depends(session)]


@dataclass(frozen=True, slots=True)
class Viewer:
    """Das Konto der Anfrage mit seinen Rechten."""

    user: User | None
    rights: frozenset[str]

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
        )
    except jwt.PyJWTError as broken:
        raise Unauthorized from broken


async def remember(db: AsyncSession, claims: dict[str, Any]) -> User:
    """Legt das Konto an oder zieht Name und Adresse nach."""
    sub = str(claims.get("sub", ""))
    if not sub:
        raise Unauthorized
    found = (await db.execute(select(User).where(User.sub == sub))).scalar_one_or_none()
    if found is None:
        found = User(sub=sub)
        db.add(found)
    found.email = claims.get("email")
    found.name = claims.get("name")
    await db.commit()
    await db.refresh(found)
    return found


async def rights_of(db: AsyncSession, user: User, claims: dict[str, Any]) -> frozenset[str]:
    """Liest die Rechte des Kontos, die Admin-Gruppe gibt alle."""
    groups: object = claims.get(GROUP_CLAIM)
    if isinstance(groups, list) and get_settings().admin_group in cast("list[object]", groups):
        keys = await db.execute(select(Permission.key))
        return frozenset(keys.scalars())
    query = (
        select(RolePermission.permission_key)
        .join(Role, Role.id == RolePermission.role_id)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user.id)
    )
    return frozenset((await db.execute(query)).scalars())


async def viewer(
    db: Db,
    authorization: Annotated[str | None, Header()] = None,
) -> Viewer:
    """Dependency: der Aufrufer, auch ohne Anmeldung."""
    token = bearer(authorization)
    if token is None:
        return Viewer(None, frozenset())
    claims = await claims_of(token)
    user = await remember(db, claims)
    return Viewer(user, await rights_of(db, user, claims))


async def optional_user(who: Annotated[Viewer, Depends(viewer)]) -> User | None:
    """Dependency: das Konto, falls eines da ist."""
    return who.user


async def current_user(who: Annotated[Viewer, Depends(viewer)]) -> User:
    """Dependency: das angemeldete Konto, sonst 401."""
    if who.user is None:
        raise Unauthorized
    return who.user


def requires(permission: str) -> Any:  # noqa: ANN401
    """Baut eine Dependency, die ein Recht verlangt."""

    async def guard(who: Annotated[Viewer, Depends(viewer)]) -> Viewer:
        if who.user is None:
            raise Unauthorized
        if not who.may(permission):
            raise Forbidden
        return who

    return Depends(guard)


CurrentUser = Annotated[User, Depends(current_user)]
OptionalUser = Annotated[User | None, Depends(optional_user)]
CurrentViewer = Annotated[Viewer, Depends(viewer)]
