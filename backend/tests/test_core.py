import time
import uuid
from http import HTTPStatus

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from jwt.algorithms import RSAAlgorithm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import auth, errors, jwks
from app.core.settings import get_settings
from app.models import Role, RolePermission, UserRole
from app.modules.access.permissions import PERMISSIONS
from app.modules.access.service import AccessService
from tests.conftest import CLIENT_ID, ISSUER, app_of, make_user, sign_in, sign_out

KID = "schluessel-1"


def a_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def a_jwk(key: rsa.RSAPrivateKey, kid: str) -> dict[str, object]:
    data = dict(RSAAlgorithm(RSAAlgorithm.SHA256).to_jwk(key.public_key(), as_dict=True))
    data.update({"kid": kid, "alg": "RS256", "use": "sig"})
    return data


class FakeIssuer:
    """Ein Issuer, den der Test in der Hand hat."""

    def __init__(self, kid: str = KID) -> None:
        self.key = a_key()
        self.kid = kid
        self.calls: list[str] = []
        self.groups: list[str] = []
        self.userinfo_status = HTTPStatus.OK

    def token(self, **claims: object) -> str:
        """Stellt ein Token aus."""
        payload: dict[str, object] = {
            "iss": ISSUER,
            "aud": CLIENT_ID,
            "sub": "person-1",
            "email": "pilz@example.test",
            "name": "Pilzsammlerin",
            "exp": 4102444800,
        }
        payload.update(claims)
        return jwt.encode(payload, self.key, algorithm="RS256", headers={"kid": self.kid})

    def answer(self, request: httpx.Request) -> httpx.Response:
        """Beantwortet Discovery, JWKS und Userinfo."""
        self.calls.append(str(request.url))
        url = str(request.url)
        if url.endswith(".well-known/openid-configuration"):
            return httpx.Response(
                200,
                json={
                    "issuer": ISSUER,
                    "jwks_uri": f"{ISSUER}jwks/",
                    "userinfo_endpoint": f"{ISSUER}userinfo/",
                },
            )
        if url.endswith("userinfo/"):
            if self.userinfo_status != HTTPStatus.OK:
                return httpx.Response(self.userinfo_status)
            return httpx.Response(200, json={"groups": self.groups})
        return httpx.Response(200, json={"keys": [a_jwk(self.key, self.kid), {"kty": "oct"}]})


@pytest.fixture
def issuer(monkeypatch: pytest.MonkeyPatch) -> FakeIssuer:
    fake = FakeIssuer()
    monkeypatch.setattr(
        jwks,
        "net_client",
        lambda: httpx.AsyncClient(
            transport=httpx.MockTransport(fake.answer),
        ),
    )
    return fake


async def guarded(api: httpx.AsyncClient, token: str) -> httpx.Response:
    """Ruft einen Endpunkt, der ein Konto verlangt."""
    return await api.put(
        "/texts/common.save",
        json={"locale": "de", "value": "Sichern"},
        headers={"Authorization": f"Bearer {token}"},
    )


def test_title_key() -> None:
    assert errors.title_key("not_found") == "error.notFound"
    assert errors.title_key("last_admin") == "error.lastAdmin"


def test_title_falls_back_to_the_code() -> None:
    errors.set_titles({})
    assert errors.title_of("not_found") == "not_found"


def test_document_carries_detail_and_fields() -> None:
    body = errors.document(errors.Invalid("kaputt", [{"field": "lat", "code": "missing"}]))
    assert body["code"] == "validation"
    assert body["status"] == HTTPStatus.UNPROCESSABLE_ENTITY
    assert body["detail"] == "kaputt"
    assert body["errors"][0]["field"] == "lat"
    assert body["type"] == "urn:primordium:error:validation"


def test_bearer_reads_the_header() -> None:
    assert auth.bearer("Bearer abc") == "abc"
    assert auth.bearer("Basic abc") is None
    assert auth.bearer(None) is None
    assert auth.bearer("Bearer  ") is None


async def test_token_signs_in(api: httpx.AsyncClient, issuer: FakeIssuer) -> None:
    answer = await api.put(
        "/texts/common.save",
        json={"locale": "de", "value": "Sichern"},
        headers={"Authorization": f"Bearer {issuer.token()}"},
    )
    assert answer.status_code == 403
    assert issuer.calls


async def test_broken_token_is_unauthorized(api: httpx.AsyncClient, issuer: FakeIssuer) -> None:  # noqa: ARG001
    assert (await guarded(api, "kaputt")).status_code == 401
    other = FakeIssuer()
    fremd = jwt.encode(
        {"sub": "x", "aud": CLIENT_ID, "iss": ISSUER, "exp": 4102444800},
        other.key,
        algorithm="RS256",
        headers={"kid": KID},
    )
    assert (await guarded(api, fremd)).status_code == 401


async def test_a_small_clock_difference_is_tolerated(
    api: httpx.AsyncClient, issuer: FakeIssuer
) -> None:
    just_expired = int(time.time()) - 5
    answer = await guarded(api, issuer.token(exp=just_expired))
    assert answer.status_code == 403


async def test_a_long_expired_token_is_unauthorized(
    api: httpx.AsyncClient, issuer: FakeIssuer
) -> None:
    long_gone = int(time.time()) - 600
    assert (await guarded(api, issuer.token(exp=long_gone))).status_code == 401


async def test_token_without_kid_is_unauthorized(
    api: httpx.AsyncClient, issuer: FakeIssuer
) -> None:
    naked = jwt.encode(
        {"sub": "x", "aud": CLIENT_ID, "iss": ISSUER, "exp": 4102444800},
        issuer.key,
        algorithm="RS256",
    )
    assert (await guarded(api, naked)).status_code == 401


async def test_unknown_kid_is_remembered(issuer: FakeIssuer) -> None:
    cache = jwks.JwksCache()
    assert await cache.key("gibt-es-nicht") is None
    before = len(issuer.calls)
    assert await cache.key("gibt-es-nicht") is None
    assert len(issuer.calls) == before
    assert await cache.key(KID) is not None


async def test_jwks_url_falls_back() -> None:
    async def broken(request: httpx.Request) -> httpx.Response:
        if str(request.url).endswith("openid-configuration"):
            return httpx.Response(404)
        return httpx.Response(200, json={"keys": []})

    async with httpx.AsyncClient(transport=httpx.MockTransport(broken)) as client:
        assert await jwks.jwks_url(client) == get_settings().jwks_url


async def test_groups_from_claims_skip_userinfo(issuer: FakeIssuer) -> None:
    claims = {"groups": [get_settings().admin_group]}
    assert await jwks.groups_of("token", claims) == [get_settings().admin_group]
    assert not issuer.calls


async def test_groups_from_userinfo_grant_admin_rights(
    session: AsyncSession,
    seeded: None,  # noqa: ARG001
    issuer: FakeIssuer,
) -> None:
    issuer.groups = [get_settings().admin_group]
    user = await make_user(session, "person-3")
    rights = await auth.rights_of(session, user, {}, "access-token")
    assert "role.manage" in rights
    assert any(call.endswith("userinfo/") for call in issuer.calls)


async def test_groups_cache_prevents_a_second_userinfo_call(
    session: AsyncSession,
    seeded: None,  # noqa: ARG001
    issuer: FakeIssuer,
) -> None:
    issuer.groups = [get_settings().admin_group]
    user = await make_user(session, "person-4")
    claims = {"jti": "tok-1", "exp": 4102444800}
    first = await auth.rights_of(session, user, claims, "access-token")
    before = sum(1 for call in issuer.calls if call.endswith("userinfo/"))
    second = await auth.rights_of(session, user, claims, "access-token")
    after = sum(1 for call in issuer.calls if call.endswith("userinfo/"))
    assert first == second
    assert after == before


async def test_userinfo_failure_grants_only_the_base_role_rights(
    session: AsyncSession,
    seeded: None,  # noqa: ARG001
    issuer: FakeIssuer,
) -> None:
    issuer.groups = [get_settings().admin_group]
    issuer.userinfo_status = HTTPStatus.INTERNAL_SERVER_ERROR
    user = await make_user(session, "person-5")
    assert await auth.rights_of(session, user, {}, "access-token") == {"image.submit"}


async def test_admin_group_grants_every_right(session: AsyncSession, seeded: None) -> None:  # noqa: ARG001
    user = await make_user(session, "admin-1")
    rights = await auth.rights_of(session, user, {"groups": [get_settings().admin_group]}, "token")
    assert "role.manage" in rights
    assert "species.edit" in rights


async def test_my_permissions_endpoint_grants_every_right_to_the_admin_group(
    api: httpx.AsyncClient,
    issuer: FakeIssuer,
) -> None:
    issuer.groups = [get_settings().admin_group]
    answer = await api.get(
        "/me/permissions",
        headers={"Authorization": f"Bearer {issuer.token(sub='admin-6')}"},
    )
    assert answer.status_code == 200
    assert answer.json() == {"permissions": sorted(PERMISSIONS)}


async def test_my_permissions_endpoint_keeps_only_role_rights_without_the_group(
    api: httpx.AsyncClient,
    session: AsyncSession,
    issuer: FakeIssuer,
) -> None:
    user = await make_user(session, "person-6")
    role = Role(id=uuid.uuid4(), slug="lokal-2", name="Lokal 2")
    session.add(role)
    await session.flush()
    session.add(RolePermission(role_id=role.id, permission_key="text.edit"))
    session.add(UserRole(user_id=user.id, role_id=role.id))
    await session.commit()
    answer = await api.get(
        "/me/permissions",
        headers={"Authorization": f"Bearer {issuer.token(sub='person-6')}"},
    )
    assert answer.status_code == 200
    assert answer.json() == {"permissions": ["image.submit", "text.edit"]}


async def test_rights_come_from_the_roles(
    session: AsyncSession,
    seeded: None,  # noqa: ARG001
    issuer: FakeIssuer,  # noqa: ARG001
) -> None:
    user = await make_user(session, "person-2")
    role = Role(id=uuid.uuid4(), slug="lokal", name="Lokal")
    session.add(role)
    await session.flush()
    session.add(RolePermission(role_id=role.id, permission_key="text.edit"))
    session.add(UserRole(user_id=user.id, role_id=role.id))
    await session.commit()
    assert await auth.rights_of(session, user, {}, "token") == {"text.edit", "image.submit"}


async def test_every_signed_in_account_holds_the_base_role_rights(
    session: AsyncSession,
    seeded: None,  # noqa: ARG001
    issuer: FakeIssuer,  # noqa: ARG001
) -> None:
    user = await make_user(session, "person-7")
    assert await auth.rights_of(session, user, {}, "token") == {"image.submit"}


def test_viewer_knows_its_rights() -> None:
    empty = auth.Viewer(None, frozenset())
    assert not empty.signed_in
    assert not empty.may("text.edit")
    assert not empty.owns(uuid.uuid4())


def a_viewer(email: str, name: str) -> auth.Viewer:
    """Ein Aufrufer mit Token, aber noch ohne Zeile."""
    return auth.Viewer(None, frozenset(), {"sub": "neu", "email": email, "name": name})


async def test_ensure_person_creates_and_updates(session: AsyncSession, schema: None) -> None:  # noqa: ARG001
    service = AccessService(session)
    first = await service.ensure_person(
        auth.Viewer(None, frozenset(), {"sub": "neu", "email": "a@b.test", "name": "A"})
    )
    again = await service.ensure_person(
        auth.Viewer(None, frozenset(), {"sub": "neu", "email": "c@d.test", "name": "C"})
    )
    assert first.id == again.id
    assert again.email == "c@d.test"
    same = await service.ensure_person(
        auth.Viewer(None, frozenset(), {"sub": "neu", "email": "c@d.test", "name": "C"})
    )
    assert same.id == first.id


async def test_viewer_does_not_write(
    session: AsyncSession,
    schema: None,  # noqa: ARG001
    issuer: FakeIssuer,  # noqa: ARG001
) -> None:
    assert await auth.person_of(session, "gibt-es-nicht") is None
    assert await auth.rights_of(session, None, {}, "token") == frozenset()


def test_requires_builds_a_dependency() -> None:
    assert auth.requires("text.edit") is not None


async def test_signed_in_helper(api: httpx.AsyncClient, session: AsyncSession) -> None:
    built: FastAPI = app_of(api)
    user = await make_user(session, "helfer")
    sign_in(built, user, "text.edit")
    sign_out(built)
