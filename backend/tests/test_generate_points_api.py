"""Tests for the /annotations/generate-points endpoint."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    """Create async test client."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


class TestGeneratePointsEndpoint:
    """Tests for POST /annotations/generate-points."""

    @pytest.fixture
    def valid_request(self) -> dict:
        """Valid request body with a square polygon."""
        return {
            "segmentation": [[0.0, 0.0, 100.0, 0.0, 100.0, 100.0, 0.0, 100.0]],
            "bbox": [0.0, 0.0, 100.0, 100.0],
            "positive_count": 2,
            "negative_count": 1,
        }

    async def test_returns_correct_point_counts(
        self, client: AsyncClient, valid_request: dict
    ) -> None:
        """Should return requested number of positive and negative points."""
        response = await client.post("/api/annotations/generate-points", json=valid_request)

        assert response.status_code == 200
        data = response.json()
        assert len(data["positive_points"]) == 2
        assert len(data["negative_points"]) == 1

    async def test_positive_points_format(
        self, client: AsyncClient, valid_request: dict
    ) -> None:
        """Positive points should have correct format."""
        response = await client.post("/api/annotations/generate-points", json=valid_request)

        data = response.json()
        for point in data["positive_points"]:
            assert "x" in point
            assert "y" in point
            assert "is_positive" in point
            assert point["is_positive"] is True

    async def test_negative_points_format(
        self, client: AsyncClient, valid_request: dict
    ) -> None:
        """Negative points should have correct format."""
        response = await client.post("/api/annotations/generate-points", json=valid_request)

        data = response.json()
        for point in data["negative_points"]:
            assert "x" in point
            assert "y" in point
            assert "is_positive" in point
            assert point["is_positive"] is False

    async def test_zero_negative_points(self, client: AsyncClient, valid_request: dict) -> None:
        """Should allow zero negative points."""
        valid_request["negative_count"] = 0
        response = await client.post("/api/annotations/generate-points", json=valid_request)

        assert response.status_code == 200
        data = response.json()
        assert len(data["negative_points"]) == 0

    async def test_invalid_positive_count_too_low(
        self, client: AsyncClient, valid_request: dict
    ) -> None:
        """Should reject positive_count < 1."""
        valid_request["positive_count"] = 0
        response = await client.post("/api/annotations/generate-points", json=valid_request)

        assert response.status_code == 400
        assert "positive_count" in response.json()["detail"]

    async def test_invalid_positive_count_too_high(
        self, client: AsyncClient, valid_request: dict
    ) -> None:
        """Should reject positive_count > 3."""
        valid_request["positive_count"] = 4
        response = await client.post("/api/annotations/generate-points", json=valid_request)

        assert response.status_code == 400
        assert "positive_count" in response.json()["detail"]

    async def test_invalid_negative_count_too_high(
        self, client: AsyncClient, valid_request: dict
    ) -> None:
        """Should reject negative_count > 3."""
        valid_request["negative_count"] = 4
        response = await client.post("/api/annotations/generate-points", json=valid_request)

        assert response.status_code == 400
        assert "negative_count" in response.json()["detail"]

    async def test_empty_segmentation(self, client: AsyncClient, valid_request: dict) -> None:
        """Should reject empty segmentation."""
        valid_request["segmentation"] = []
        response = await client.post("/api/annotations/generate-points", json=valid_request)

        assert response.status_code == 400
        assert "segmentation" in response.json()["detail"]

    async def test_default_counts(self, client: AsyncClient) -> None:
        """Should use default counts when not specified."""
        request = {
            "segmentation": [[0.0, 0.0, 100.0, 0.0, 100.0, 100.0, 0.0, 100.0]],
            "bbox": [0.0, 0.0, 100.0, 100.0],
        }
        response = await client.post("/api/annotations/generate-points", json=request)

        assert response.status_code == 200
        data = response.json()
        # Defaults are positive_count=2, negative_count=1
        assert len(data["positive_points"]) == 2
        assert len(data["negative_points"]) == 1
