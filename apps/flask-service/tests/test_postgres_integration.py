import io
import os

import pytest

from evidencebridge.app import create_app
from evidencebridge.repository import PostgresRepository


@pytest.mark.skipif(
    os.getenv("RUN_POSTGRES_TESTS") != "true",
    reason="requires the migrated PostgreSQL service used in CI or Docker Compose",
)
def test_prisma_schema_supports_flask_ingestion_and_retrieval():
    database_url = os.environ["DATABASE_URL"]
    repository = PostgresRepository(database_url)
    app = create_app({"TESTING": True, "SERVICE_TOKEN": None}, repository=repository)
    client = app.test_client()
    workspace_id = None
    try:
        workspace = client.post("/api/workspaces", json={"name": "PostgreSQL integration"})
        assert workspace.status_code == 201
        workspace_id = workspace.get_json()["id"]
        uploaded = client.post(
            "/api/documents",
            data={
                "workspace_id": workspace_id,
                "title": "Integration fixture",
                "version": "1",
                "file": (io.BytesIO(b"Evidence survives a database round trip."), "fixture.md"),
            },
            content_type="multipart/form-data",
        )
        assert uploaded.status_code == 201
        search = client.post(
            "/api/search",
            json={"workspace_id": workspace_id, "query": "database round trip"},
        )
        assert search.status_code == 200
        assert "database round trip" in search.get_json()["results"][0]["quote"]
    finally:
        if workspace_id:
            with repository._connect() as connection, connection.cursor() as cursor:
                cursor.execute('DELETE FROM "workspaces" WHERE id=%s', (workspace_id,))
