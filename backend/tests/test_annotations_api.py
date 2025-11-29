from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.api import annotations
from app.main import app
from app.models.sam_model import MockSAMModel, set_sam_model
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


class TestMergeAnnotations:
    """Tests for merging multiple annotations into one."""

    async def test_merge_two_annotations(self, client: AsyncClient):
        """Test merging two non-overlapping annotations."""
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]

        # Create two separate annotations (two squares side by side)
        ann1 = {
            "class_id": 1,
            "class_name": "cell_type_1",
            "segmentation": [[0, 0, 50, 0, 50, 50, 0, 50]],  # Left square
            "bbox": [0, 0, 50, 50],
            "area": 2500.0,
        }
        ann2 = {
            "class_id": 2,
            "class_name": "cell_type_2",
            "segmentation": [[60, 0, 110, 0, 110, 50, 60, 50]],  # Right square
            "bbox": [60, 0, 50, 50],
            "area": 2500.0,
        }

        resp1 = await client.post(f"/api/annotations/{image_id}", json=ann1)
        resp2 = await client.post(f"/api/annotations/{image_id}", json=ann2)
        id1 = resp1.json()["id"]
        id2 = resp2.json()["id"]

        # Merge the two annotations
        merge_request = {
            "annotation_ids": [id1, id2],
            "class_id": 3,
            "class_name": "merged_cell",
        }
        response = await client.post("/api/annotations/merge", json=merge_request)
        assert response.status_code == 201
        merged = response.json()

        # Check merged annotation
        assert "id" in merged
        assert merged["class_id"] == 3
        assert merged["class_name"] == "merged_cell"
        assert merged["image_id"] == image_id
        # Should have segmentation data
        assert len(merged["segmentation"]) >= 1
        # Area should be sum of both (or close, accounting for union)
        assert merged["area"] > 0

        # Original annotations should be deleted
        get_response = await client.get(f"/api/annotations/{image_id}")
        remaining = get_response.json()
        remaining_ids = [a["id"] for a in remaining]
        assert id1 not in remaining_ids
        assert id2 not in remaining_ids
        assert merged["id"] in remaining_ids

    async def test_merge_overlapping_annotations(self, client: AsyncClient):
        """Test merging overlapping annotations - union removes overlap."""
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]

        # Create two overlapping squares
        ann1 = {
            "class_id": 1,
            "class_name": "cell_type_1",
            "segmentation": [[0, 0, 60, 0, 60, 60, 0, 60]],  # 60x60 square at origin
            "bbox": [0, 0, 60, 60],
            "area": 3600.0,
        }
        ann2 = {
            "class_id": 2,
            "class_name": "cell_type_2",
            "segmentation": [[30, 30, 90, 30, 90, 90, 30, 90]],  # 60x60 square offset
            "bbox": [30, 30, 60, 60],
            "area": 3600.0,
        }

        resp1 = await client.post(f"/api/annotations/{image_id}", json=ann1)
        resp2 = await client.post(f"/api/annotations/{image_id}", json=ann2)
        id1 = resp1.json()["id"]
        id2 = resp2.json()["id"]

        # Merge
        merge_request = {
            "annotation_ids": [id1, id2],
            "class_id": 1,
            "class_name": "merged",
        }
        response = await client.post("/api/annotations/merge", json=merge_request)
        assert response.status_code == 201
        merged = response.json()

        # Area should be less than sum due to overlap
        # Two 60x60 squares with 30x30 overlap: 3600 + 3600 - 900 = 6300
        assert merged["area"] < 7200  # Less than simple sum
        assert merged["area"] > 3600  # More than single square

    async def test_merge_single_annotation_fails(self, client: AsyncClient):
        """Test that merging a single annotation fails."""
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]

        ann = {
            "class_id": 1,
            "class_name": "cell_type_1",
            "segmentation": [[0, 0, 50, 0, 50, 50, 0, 50]],
            "bbox": [0, 0, 50, 50],
            "area": 2500.0,
        }
        resp = await client.post(f"/api/annotations/{image_id}", json=ann)
        ann_id = resp.json()["id"]

        # Try to merge single annotation
        merge_request = {
            "annotation_ids": [ann_id],
            "class_id": 1,
            "class_name": "merged",
        }
        response = await client.post("/api/annotations/merge", json=merge_request)
        assert response.status_code == 400

    async def test_merge_nonexistent_annotation_fails(self, client: AsyncClient):
        """Test that merging with nonexistent annotation fails."""
        merge_request = {
            "annotation_ids": ["nonexistent-id-1", "nonexistent-id-2"],
            "class_id": 1,
            "class_name": "merged",
        }
        response = await client.post("/api/annotations/merge", json=merge_request)
        assert response.status_code == 404

    async def test_merge_different_images_fails(self, client: AsyncClient):
        """Test that merging annotations from different images fails."""
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) < 2:
            pytest.skip("Need at least 2 images")

        image_id1 = images[0]["id"]
        image_id2 = images[1]["id"]

        ann = {
            "class_id": 1,
            "class_name": "cell_type_1",
            "segmentation": [[0, 0, 50, 0, 50, 50, 0, 50]],
            "bbox": [0, 0, 50, 50],
            "area": 2500.0,
        }

        resp1 = await client.post(f"/api/annotations/{image_id1}", json=ann)
        resp2 = await client.post(f"/api/annotations/{image_id2}", json=ann)
        id1 = resp1.json()["id"]
        id2 = resp2.json()["id"]

        # Try to merge annotations from different images
        merge_request = {
            "annotation_ids": [id1, id2],
            "class_id": 1,
            "class_name": "merged",
        }
        response = await client.post("/api/annotations/merge", json=merge_request)
        assert response.status_code == 400


class TestBrushModifyAnnotation:
    """Tests for brush tool to modify annotation geometry."""

    async def test_brush_add_expands_annotation(self, client: AsyncClient):
        """Test that brush add operation expands the annotation area."""
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]

        # Create a square annotation
        ann = {
            "class_id": 1,
            "class_name": "cell_type_1",
            "segmentation": [[100, 100, 200, 100, 200, 200, 100, 200]],  # 100x100 square
            "bbox": [100, 100, 100, 100],
            "area": 10000.0,
        }
        resp = await client.post(f"/api/annotations/{image_id}", json=ann)
        annotation_id = resp.json()["id"]
        original_area = resp.json()["area"]

        # Apply brush stroke to add area (paint outside the original square)
        brush_request = {
            "brush_path": [(200, 150), (250, 150)],  # Line extending right from square
            "brush_radius": 20.0,
            "operation": "add",
        }
        response = await client.patch(
            f"/api/annotations/{annotation_id}/brush", json=brush_request
        )
        assert response.status_code == 200
        modified = response.json()

        # Area should have increased
        assert modified["area"] > original_area
        assert modified["id"] == annotation_id

    async def test_brush_remove_shrinks_annotation(self, client: AsyncClient):
        """Test that brush remove operation shrinks the annotation area."""
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]

        # Create a square annotation
        ann = {
            "class_id": 1,
            "class_name": "cell_type_1",
            "segmentation": [[100, 100, 200, 100, 200, 200, 100, 200]],  # 100x100 square
            "bbox": [100, 100, 100, 100],
            "area": 10000.0,
        }
        resp = await client.post(f"/api/annotations/{image_id}", json=ann)
        annotation_id = resp.json()["id"]
        original_area = resp.json()["area"]

        # Apply brush stroke to remove area (paint inside the square)
        brush_request = {
            "brush_path": [(120, 150), (180, 150)],  # Line inside the square
            "brush_radius": 15.0,
            "operation": "remove",
        }
        response = await client.patch(
            f"/api/annotations/{annotation_id}/brush", json=brush_request
        )
        assert response.status_code == 200
        modified = response.json()

        # Area should have decreased
        assert modified["area"] < original_area
        assert modified["id"] == annotation_id

    async def test_brush_single_point(self, client: AsyncClient):
        """Test brush with a single point creates a circle."""
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]

        # Create a square annotation
        ann = {
            "class_id": 1,
            "class_name": "cell_type_1",
            "segmentation": [[100, 100, 200, 100, 200, 200, 100, 200]],
            "bbox": [100, 100, 100, 100],
            "area": 10000.0,
        }
        resp = await client.post(f"/api/annotations/{image_id}", json=ann)
        annotation_id = resp.json()["id"]
        original_area = resp.json()["area"]

        # Apply single point brush outside the square
        brush_request = {
            "brush_path": [(250, 150)],  # Single point to the right
            "brush_radius": 20.0,
            "operation": "add",
        }
        response = await client.patch(
            f"/api/annotations/{annotation_id}/brush", json=brush_request
        )
        assert response.status_code == 200
        modified = response.json()

        # Area should have increased (circle added)
        assert modified["area"] > original_area

    async def test_brush_nonexistent_annotation(self, client: AsyncClient):
        """Test brush on nonexistent annotation returns 404."""
        brush_request = {
            "brush_path": [(100, 100), (150, 100)],
            "brush_radius": 10.0,
            "operation": "add",
        }
        response = await client.patch(
            "/api/annotations/nonexistent-id/brush", json=brush_request
        )
        assert response.status_code == 404

    async def test_brush_empty_path_fails(self, client: AsyncClient):
        """Test brush with empty path returns 400."""
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]

        ann = {
            "class_id": 1,
            "class_name": "cell_type_1",
            "segmentation": [[100, 100, 200, 100, 200, 200, 100, 200]],
            "bbox": [100, 100, 100, 100],
            "area": 10000.0,
        }
        resp = await client.post(f"/api/annotations/{image_id}", json=ann)
        annotation_id = resp.json()["id"]

        brush_request = {
            "brush_path": [],
            "brush_radius": 10.0,
            "operation": "add",
        }
        response = await client.patch(
            f"/api/annotations/{annotation_id}/brush", json=brush_request
        )
        assert response.status_code == 400

    async def test_brush_zero_radius_fails(self, client: AsyncClient):
        """Test brush with zero radius returns 400."""
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]

        ann = {
            "class_id": 1,
            "class_name": "cell_type_1",
            "segmentation": [[100, 100, 200, 100, 200, 200, 100, 200]],
            "bbox": [100, 100, 100, 100],
            "area": 10000.0,
        }
        resp = await client.post(f"/api/annotations/{image_id}", json=ann)
        annotation_id = resp.json()["id"]

        brush_request = {
            "brush_path": [(100, 100), (150, 100)],
            "brush_radius": 0,
            "operation": "add",
        }
        response = await client.patch(
            f"/api/annotations/{annotation_id}/brush", json=brush_request
        )
        assert response.status_code == 400

    async def test_brush_fill_hole(self, client: AsyncClient):
        """Test brush can fill a hole in an annotation."""
        list_response = await client.get("/api/images")
        images = list_response.json()
        if len(images) == 0:
            pytest.skip("No images available")

        image_id = images[0]["id"]

        # Create an L-shaped annotation (like a square with a corner cut out)
        # This simulates a "hole" scenario where add brush can fill gap
        ann = {
            "class_id": 1,
            "class_name": "cell_type_1",
            "segmentation": [[0, 0, 100, 0, 100, 50, 50, 50, 50, 100, 0, 100]],  # L-shape
            "bbox": [0, 0, 100, 100],
            "area": 7500.0,
        }
        resp = await client.post(f"/api/annotations/{image_id}", json=ann)
        annotation_id = resp.json()["id"]
        original_area = resp.json()["area"]

        # Paint in the "missing corner" to fill it
        brush_request = {
            "brush_path": [(75, 75)],  # Single point in the gap
            "brush_radius": 30.0,
            "operation": "add",
        }
        response = await client.patch(
            f"/api/annotations/{annotation_id}/brush", json=brush_request
        )
        assert response.status_code == 200
        modified = response.json()

        # Area should have increased (gap filled)
        assert modified["area"] > original_area
