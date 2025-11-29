import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import patch
import numpy as np

from app.main import app
from app.models.sam_model import MockSAMModel, set_sam_model


@pytest.fixture(autouse=True)
def setup_mock_sam():
    """Set up mock SAM model for all tests."""
    set_sam_model(MockSAMModel())
    yield


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


class TestSAMAPI:
    async def test_encode_image_returns_success(self, client: AsyncClient):
        # Get first image
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]
        response = await client.post(f"/api/sam/encode/{image_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "encoded"
        assert data["image_id"] == image_id

    async def test_encode_returns_404_for_invalid_image(self, client: AsyncClient):
        response = await client.post("/api/sam/encode/nonexistent")
        assert response.status_code == 404

    async def test_segment_returns_mask(self, client: AsyncClient):
        # Get first image and encode it
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]
        await client.post(f"/api/sam/encode/{image_id}")

        # Request segmentation
        response = await client.post(
            "/api/sam/segment",
            json={
                "image_id": image_id,
                "points": [{"x": 100, "y": 100, "is_positive": True}],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "polygon" in data
        assert "bbox" in data
        assert "area" in data
        assert "score" in data

    async def test_segment_with_multiple_points(self, client: AsyncClient):
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]
        await client.post(f"/api/sam/encode/{image_id}")

        response = await client.post(
            "/api/sam/segment",
            json={
                "image_id": image_id,
                "points": [
                    {"x": 100, "y": 100, "is_positive": True},
                    {"x": 50, "y": 50, "is_positive": False},
                ],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "polygon" in data

    async def test_segment_requires_encode_first(self, client: AsyncClient):
        # Try to segment without encoding (use a different image_id)
        response = await client.post(
            "/api/sam/segment",
            json={
                "image_id": "not_encoded_image",
                "points": [{"x": 100, "y": 100, "is_positive": True}],
            },
        )
        assert response.status_code == 400

    async def test_segment_requires_at_least_one_point(self, client: AsyncClient):
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]
        await client.post(f"/api/sam/encode/{image_id}")

        response = await client.post(
            "/api/sam/segment",
            json={"image_id": image_id, "points": []},
        )
        assert response.status_code == 400
