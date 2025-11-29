import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


class TestImagesAPI:
    async def test_list_images_returns_list(self, client: AsyncClient):
        response = await client.get("/api/images")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_list_images_contains_metadata(self, client: AsyncClient):
        response = await client.get("/api/images")
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            image = data[0]
            assert "id" in image
            assert "filename" in image
            assert "width" in image
            assert "height" in image

    async def test_get_image_returns_png(self, client: AsyncClient):
        # First get list of images
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]
        response = await client.get(f"/api/images/{image_id}")
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        # Check PNG magic bytes
        assert response.content[:8] == b"\x89PNG\r\n\x1a\n"

    async def test_get_image_returns_404_for_invalid_id(self, client: AsyncClient):
        response = await client.get("/api/images/nonexistent_image")
        assert response.status_code == 404

    async def test_get_image_info_returns_dimensions(self, client: AsyncClient):
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]
        response = await client.get(f"/api/images/{image_id}/info")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "width" in data
        assert "height" in data
        assert data["width"] > 0
        assert data["height"] > 0

    async def test_get_image_info_returns_404_for_invalid_id(self, client: AsyncClient):
        response = await client.get("/api/images/nonexistent_image/info")
        assert response.status_code == 404
