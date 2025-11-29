import shutil
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.sam_model import MockSAMModel, set_sam_model
from app.api import annotations
from app.utils.annotation_store import AnnotationStore


@pytest.fixture(autouse=True)
def setup_mock_sam():
    """Set up mock SAM model for all tests."""
    set_sam_model(MockSAMModel())
    yield


@pytest.fixture(autouse=True)
def clean_annotations_store(tmp_path: Path):
    """Use a temporary directory for annotations during tests."""
    test_dir = tmp_path / "annotations"
    test_dir.mkdir()
    # Replace the global annotation store with one using temp directory
    annotations.annotation_store = AnnotationStore(test_dir)
    yield
    # Cleanup happens automatically with tmp_path


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sample_annotation():
    return {
        "class_id": 1,
        "class_name": "cell_type_1",
        "segmentation": [[100, 100, 150, 100, 150, 150, 100, 150]],
        "bbox": [100, 100, 50, 50],
        "area": 2500.0,
    }


class TestAnnotationsAPI:
    async def test_get_annotations_empty(self, client: AsyncClient):
        # Get first image
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]
        response = await client.get(f"/api/annotations/{image_id}")
        assert response.status_code == 200
        assert response.json() == []

    async def test_create_annotation(self, client: AsyncClient, sample_annotation: dict):
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]
        response = await client.post(f"/api/annotations/{image_id}", json=sample_annotation)
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["image_id"] == image_id
        assert data["class_id"] == sample_annotation["class_id"]
        assert data["class_name"] == sample_annotation["class_name"]
        assert "created_at" in data

    async def test_get_annotations_after_create(
        self, client: AsyncClient, sample_annotation: dict
    ):
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]

        # Create annotation
        await client.post(f"/api/annotations/{image_id}", json=sample_annotation)

        # Get annotations
        response = await client.get(f"/api/annotations/{image_id}")
        assert response.status_code == 200
        annotations = response.json()
        assert len(annotations) >= 1

    async def test_update_annotation(self, client: AsyncClient, sample_annotation: dict):
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]

        # Create annotation
        create_response = await client.post(
            f"/api/annotations/{image_id}", json=sample_annotation
        )
        annotation_id = create_response.json()["id"]

        # Update annotation
        update_data = {"class_id": 2, "class_name": "cell_type_2"}
        response = await client.put(f"/api/annotations/{annotation_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["class_id"] == 2
        assert data["class_name"] == "cell_type_2"

    async def test_delete_annotation(self, client: AsyncClient, sample_annotation: dict):
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]

        # Create annotation
        create_response = await client.post(
            f"/api/annotations/{image_id}", json=sample_annotation
        )
        annotation_id = create_response.json()["id"]

        # Delete annotation
        response = await client.delete(f"/api/annotations/{annotation_id}")
        assert response.status_code == 204

        # Verify deleted
        get_response = await client.get(f"/api/annotations/{image_id}")
        annotations = get_response.json()
        assert not any(a["id"] == annotation_id for a in annotations)

    async def test_delete_nonexistent_annotation(self, client: AsyncClient):
        response = await client.delete("/api/annotations/nonexistent-id")
        assert response.status_code == 404
