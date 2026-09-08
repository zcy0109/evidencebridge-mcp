import pytest

from evidencebridge.app import create_app
from evidencebridge.repository import MemoryRepository


@pytest.fixture()
def repository():
    return MemoryRepository()


@pytest.fixture()
def client(repository):
    app = create_app({"TESTING": True, "SERVICE_TOKEN": None}, repository=repository)
    return app.test_client()
