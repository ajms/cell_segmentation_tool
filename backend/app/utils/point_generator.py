"""Point generation utilities for label transfer.

Generates positive and negative points from polygon segmentations
for use with SAM inference when transferring labels between slices.
"""

import numpy as np
from shapely.geometry import Point, Polygon


def generate_positive_points(polygon_coords: list[float], count: int) -> list[dict]:
    """Generate positive points inside a polygon for SAM inference.

    Uses centroid-based approach:
    - First point is at or near the polygon centroid
    - Additional points spread along the polygon's major axis

    Args:
        polygon_coords: Flat list of coordinates [x1, y1, x2, y2, ...]
        count: Number of positive points to generate (1-3)

    Returns:
        List of point dicts with x, y, is_positive fields
    """
    if count < 1:
        return []

    # Convert flat coords to coordinate pairs
    coords = [(polygon_coords[i], polygon_coords[i + 1]) for i in range(0, len(polygon_coords), 2)]
    poly = Polygon(coords)

    if not poly.is_valid:
        poly = poly.buffer(0)  # Fix invalid polygons

    points: list[dict] = []

    # First point: centroid (or representative point if centroid outside for concave polygons)
    centroid = poly.centroid
    first_point = centroid if poly.contains(centroid) else poly.representative_point()

    points.append({"x": float(first_point.x), "y": float(first_point.y), "is_positive": True})

    if count == 1:
        return points

    # For additional points, spread along the polygon's major axis
    # Use oriented minimum bounding rectangle to find the axis
    minx, miny, maxx, maxy = poly.bounds
    width = maxx - minx
    height = maxy - miny

    # Determine major axis direction
    if width >= height:
        # Horizontal major axis - spread points along x
        offsets = _get_axis_offsets(count - 1)
        for offset in offsets:
            x = first_point.x + offset * (width / 3)
            y = first_point.y
            candidate = Point(x, y)
            if poly.contains(candidate):
                points.append({"x": float(x), "y": float(y), "is_positive": True})
            else:
                # Find nearest point inside polygon
                point = _find_point_inside(poly, x, y)
                points.append({"x": float(point.x), "y": float(point.y), "is_positive": True})
    else:
        # Vertical major axis - spread points along y
        offsets = _get_axis_offsets(count - 1)
        for offset in offsets:
            x = first_point.x
            y = first_point.y + offset * (height / 3)
            candidate = Point(x, y)
            if poly.contains(candidate):
                points.append({"x": float(x), "y": float(y), "is_positive": True})
            else:
                point = _find_point_inside(poly, x, y)
                points.append({"x": float(point.x), "y": float(point.y), "is_positive": True})

    return points[:count]  # Ensure we don't exceed requested count


def generate_negative_points(
    bbox: list[float], polygon_coords: list[float], count: int
) -> list[dict]:
    """Generate negative points just outside the bounding box.

    Places points at a small offset outside the bbox edges,
    ensuring they are not inside the polygon.

    Args:
        bbox: Bounding box [x, y, width, height]
        polygon_coords: Flat list of coordinates [x1, y1, x2, y2, ...]
        count: Number of negative points to generate (0-3)

    Returns:
        List of point dicts with x, y, is_positive fields
    """
    if count < 1:
        return []

    x, y, w, h = bbox
    offset = 10.0  # Pixels outside bbox

    # Convert coords to polygon for containment check
    coords = [(polygon_coords[i], polygon_coords[i + 1]) for i in range(0, len(polygon_coords), 2)]
    poly = Polygon(coords)

    # Generate candidate positions around the bbox
    # Place points at the midpoint of each edge, offset outward
    candidates = [
        # Top edge (above)
        (x + w / 2, y - offset),
        # Right edge
        (x + w + offset, y + h / 2),
        # Bottom edge (below)
        (x + w / 2, y + h + offset),
        # Left edge
        (x - offset, y + h / 2),
    ]

    points: list[dict] = []
    for cx, cy in candidates:
        if len(points) >= count:
            break
        candidate = Point(cx, cy)
        if not poly.contains(candidate):
            points.append({"x": float(cx), "y": float(cy), "is_positive": False})

    # If we need more points, add corner points
    if len(points) < count:
        corner_candidates = [
            (x - offset, y - offset),  # Top-left
            (x + w + offset, y - offset),  # Top-right
            (x + w + offset, y + h + offset),  # Bottom-right
            (x - offset, y + h + offset),  # Bottom-left
        ]
        for cx, cy in corner_candidates:
            if len(points) >= count:
                break
            candidate = Point(cx, cy)
            if not poly.contains(candidate):
                points.append({"x": float(cx), "y": float(cy), "is_positive": False})

    return points[:count]


def _get_axis_offsets(count: int) -> list[float]:
    """Get offset multipliers for spreading points along an axis.

    Args:
        count: Number of offsets needed

    Returns:
        List of offset multipliers (e.g., [-1, 1] for 2 points)
    """
    if count == 1:
        return [1.0]
    elif count == 2:
        return [-1.0, 1.0]
    else:
        return [-1.0, 1.0]  # For 3+ we still use 2 additional points


def _find_point_inside(poly: Polygon, x: float, y: float) -> Point:
    """Find a point inside the polygon near the given coordinates.

    Uses the polygon's representative point as fallback.

    Args:
        poly: Shapely Polygon
        x: Target x coordinate
        y: Target y coordinate

    Returns:
        A Point guaranteed to be inside the polygon
    """
    # Try points along a line from target to centroid
    centroid = poly.centroid
    for t in np.linspace(0, 1, 10):
        px = x + t * (centroid.x - x)
        py = y + t * (centroid.y - y)
        candidate = Point(px, py)
        if poly.contains(candidate):
            return candidate

    # Fallback to representative point
    return poly.representative_point()
