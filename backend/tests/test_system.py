import httpx

from app.core.errors import allowed_methods
from tests.conftest import app_of


async def test_health(api: httpx.AsyncClient) -> None:
    answer = await api.get("/health")
    assert answer.status_code == 200
    assert answer.json() == {"status": "ok"}


async def test_config(api: httpx.AsyncClient) -> None:
    answer = await api.get("/config")
    assert answer.status_code == 200
    assert answer.json()["oidcClientId"] == "pilze"


async def test_unknown_path_is_a_problem(api: httpx.AsyncClient) -> None:
    answer = await api.get("/nirgendwo")
    assert answer.status_code == 404
    assert answer.headers["content-type"].startswith("application/problem+json")
    assert answer.json()["code"] == "not_found"
    assert answer.json()["title"] == "Nicht gefunden"


async def test_unknown_query_parameter_is_rejected(api: httpx.AsyncClient) -> None:
    answer = await api.get("/texts", params={"gibtEsNicht": "1"})
    assert answer.status_code == 422
    assert answer.json()["errors"][0]["field"] == "gibtEsNicht"


async def test_a_bracket_parameter_passes(api: httpx.AsyncClient) -> None:
    assert (await api.get("/species", params={"colour[cap]": "#ffffff"})).status_code == 200


async def test_a_method_outside_the_contract_is_405(api: httpx.AsyncClient) -> None:
    answer = await api.put("/species/bundle", json={})
    assert answer.status_code == 405
    assert answer.headers["allow"] == "GET, HEAD"
    assert answer.json()["code"] == "method_not_allowed"


async def test_allow_lists_the_methods_of_the_path(api: httpx.AsyncClient) -> None:
    answer = await api.request("OPTIONS", "/species")
    assert answer.status_code == 405
    assert answer.headers["allow"] == "GET, HEAD, POST"


async def test_the_method_index_is_built_once(api: httpx.AsyncClient) -> None:
    built = app_of(api)
    assert allowed_methods(built, "/api/health") == ["GET", "HEAD"]
    assert allowed_methods(built, "/api/health") == ["GET", "HEAD"]
    assert allowed_methods(built, "/api/gibt-es-nicht") == []
