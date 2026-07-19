from fastapi.testclient import TestClient

from app.main import app


def test_health_and_readiness() -> None:
    client = TestClient(app)

    assert client.get("/healthz").json() == {
        "status": "ok",
        "service": "scrollstack-backend",
    }
    assert client.get("/readyz").json() == {
        "status": "ready",
        "service": "scrollstack-backend",
    }
