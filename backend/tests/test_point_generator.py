"""Tests for point generation utilities used in label transfer."""

import pytest
from shapely.geometry import Polygon

from app.utils.point_generator import (
    generate_negative_points,
    generate_positive_points,
)


class TestGeneratePositivePoints:
    """Tests for generate_positive_points function."""

    @pytest.fixture
    def square_polygon(self) -> list[float]:
        """A simple 100x100 square polygon centered at (50, 50)."""
        return [0.0, 0.0, 100.0, 0.0, 100.0, 100.0, 0.0, 100.0]

    @pytest.fixture
    def rectangle_polygon(self) -> list[float]:
        """A 200x50 rectangle (elongated horizontally)."""
        return [0.0, 0.0, 200.0, 0.0, 200.0, 50.0, 0.0, 50.0]

    def test_returns_requested_count(self, square_polygon: list[float]) -> None:
        """Should return exactly the requested number of points."""
        for count in [1, 2, 3]:
            points = generate_positive_points(square_polygon, count)
            assert len(points) == count

    def test_first_point_is_centroid(self, square_polygon: list[float]) -> None:
        """First point should be at or near the polygon centroid."""
        points = generate_positive_points(square_polygon, 1)
        assert len(points) == 1
        # Centroid of 100x100 square at origin is (50, 50)
        assert points[0]["x"] == pytest.approx(50.0, abs=1.0)
        assert points[0]["y"] == pytest.approx(50.0, abs=1.0)
        assert points[0]["is_positive"] is True

    def test_all_points_inside_polygon(self, square_polygon: list[float]) -> None:
        """All generated points should be inside the polygon."""
        points = generate_positive_points(square_polygon, 3)
        coords = [(square_polygon[i], square_polygon[i + 1]) for i in range(0, len(square_polygon), 2)]
        poly = Polygon(coords)

        for p in points:
            from shapely.geometry import Point

            point = Point(p["x"], p["y"])
            assert poly.contains(point) or poly.touches(point), f"Point ({p['x']}, {p['y']}) not inside polygon"

    def test_points_have_correct_format(self, square_polygon: list[float]) -> None:
        """Points should have x, y, and is_positive fields."""
        points = generate_positive_points(square_polygon, 2)
        for p in points:
            assert "x" in p
            assert "y" in p
            assert "is_positive" in p
            assert isinstance(p["x"], float)
            assert isinstance(p["y"], float)
            assert p["is_positive"] is True

    def test_points_spread_along_axes(self, rectangle_polygon: list[float]) -> None:
        """Additional points should spread along the major axis."""
        points = generate_positive_points(rectangle_polygon, 3)
        # Centroid is at (100, 25)
        # With elongated shape, points should spread horizontally
        xs = [p["x"] for p in points]
        # Points should have some spread along x axis
        assert max(xs) - min(xs) > 10, "Points should spread along major axis"

    def test_concave_polygon_centroid_inside(self) -> None:
        """For concave polygons, ensure points are still inside."""
        # L-shaped polygon
        l_shape = [0.0, 0.0, 100.0, 0.0, 100.0, 50.0, 50.0, 50.0, 50.0, 100.0, 0.0, 100.0]
        points = generate_positive_points(l_shape, 3)
        coords = [(l_shape[i], l_shape[i + 1]) for i in range(0, len(l_shape), 2)]
        poly = Polygon(coords)

        for p in points:
            from shapely.geometry import Point

            point = Point(p["x"], p["y"])
            assert poly.contains(point), f"Point ({p['x']}, {p['y']}) not inside L-shaped polygon"


class TestGenerateNegativePoints:
    """Tests for generate_negative_points function."""

    @pytest.fixture
    def bbox(self) -> list[float]:
        """Bounding box: [x, y, width, height]."""
        return [10.0, 20.0, 100.0, 80.0]  # x=10, y=20, w=100, h=80

    @pytest.fixture
    def square_polygon(self) -> list[float]:
        """A polygon inside the bbox."""
        return [10.0, 20.0, 110.0, 20.0, 110.0, 100.0, 10.0, 100.0]

    def test_returns_zero_points_when_requested(self, bbox: list[float], square_polygon: list[float]) -> None:
        """Should return empty list when count is 0."""
        points = generate_negative_points(bbox, square_polygon, 0)
        assert len(points) == 0

    def test_returns_requested_count(self, bbox: list[float], square_polygon: list[float]) -> None:
        """Should return exactly the requested number of points."""
        for count in [1, 2, 3]:
            points = generate_negative_points(bbox, square_polygon, count)
            assert len(points) == count

    def test_points_outside_bbox(self, bbox: list[float], square_polygon: list[float]) -> None:
        """Points should be just outside the bounding box."""
        points = generate_negative_points(bbox, square_polygon, 3)
        x, y, w, h = bbox

        for p in points:
            px, py = p["x"], p["y"]
            # Point should be outside the bbox
            inside = x <= px <= x + w and y <= py <= y + h
            assert not inside, f"Point ({px}, {py}) is inside bbox"

    def test_points_not_inside_polygon(self, bbox: list[float], square_polygon: list[float]) -> None:
        """Points should not be inside the polygon."""
        points = generate_negative_points(bbox, square_polygon, 3)
        coords = [(square_polygon[i], square_polygon[i + 1]) for i in range(0, len(square_polygon), 2)]
        poly = Polygon(coords)

        for p in points:
            from shapely.geometry import Point

            point = Point(p["x"], p["y"])
            assert not poly.contains(point), f"Negative point ({p['x']}, {p['y']}) is inside polygon"

    def test_points_have_correct_format(self, bbox: list[float], square_polygon: list[float]) -> None:
        """Points should have x, y, and is_positive fields."""
        points = generate_negative_points(bbox, square_polygon, 2)
        for p in points:
            assert "x" in p
            assert "y" in p
            assert "is_positive" in p
            assert isinstance(p["x"], float)
            assert isinstance(p["y"], float)
            assert p["is_positive"] is False

    def test_points_close_to_bbox(self, bbox: list[float], square_polygon: list[float]) -> None:
        """Points should be close to the bbox (not far away)."""
        points = generate_negative_points(bbox, square_polygon, 3)
        x, y, w, h = bbox
        offset_threshold = 20.0  # Should be within 20 pixels of bbox

        for p in points:
            px, py = p["x"], p["y"]
            # Distance to nearest bbox edge
            dist_left = abs(px - x)
            dist_right = abs(px - (x + w))
            dist_top = abs(py - y)
            dist_bottom = abs(py - (y + h))
            min_dist = min(dist_left, dist_right, dist_top, dist_bottom)
            assert min_dist <= offset_threshold, f"Point ({px}, {py}) too far from bbox"
