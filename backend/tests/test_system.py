import httpx


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
