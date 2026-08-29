import os
from pathlib import Path

import pytest


TEST_DB = Path("/tmp/tea-bti-api-test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["AI_MODE"] = "mock"

from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def clean_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth(client):
    response = client.post("/api/v1/sessions/anonymous")
    assert response.status_code == 201
    token = response.json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}
