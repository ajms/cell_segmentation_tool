import json
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import TypedDict

from shapely.geometry import Polygon
from shapely.ops import unary_union


class AnnotationData(TypedDict):
    id: str
    image_id: str
    class_id: int
    class_name: str
    segmentation: list[list[float]]
    bbox: list[float]
    area: float
    created_at: str


class AnnotationStore:
    """Simple JSON-based annotation storage."""

    def __init__(self, storage_dir: Path):
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _get_file_path(self, image_id: str) -> Path:
        """Get the JSON file path for an image's annotations."""
        return self.storage_dir / f"{image_id}.json"

    def _load_annotations(self, image_id: str) -> list[AnnotationData]:
        """Load annotations for an image from disk."""
        file_path = self._get_file_path(image_id)
        if not file_path.exists():
            return []
        with open(file_path) as f:
            return json.load(f)

    def _save_annotations(self, image_id: str, annotations: list[AnnotationData]) -> None:
        """Save annotations for an image to disk."""
        file_path = self._get_file_path(image_id)
        with open(file_path, "w") as f:
            json.dump(annotations, f, indent=2)

    def get_annotations(self, image_id: str) -> list[AnnotationData]:
        """Get all annotations for an image."""
        return self._load_annotations(image_id)

    def create_annotation(
        self,
        image_id: str,
        class_id: int,
        class_name: str,
        segmentation: list[list[float]],
        bbox: list[float],
        area: float,
    ) -> AnnotationData:
        """Create a new annotation."""
        annotations = self._load_annotations(image_id)

        annotation: AnnotationData = {
            "id": str(uuid.uuid4()),
            "image_id": image_id,
            "class_id": class_id,
            "class_name": class_name,
            "segmentation": segmentation,
            "bbox": bbox,
            "area": area,
            "created_at": datetime.now(UTC).isoformat(),
        }

        annotations.append(annotation)
        self._save_annotations(image_id, annotations)
        return annotation

    def update_annotation(
        self,
        annotation_id: str,
        class_id: int | None = None,
        class_name: str | None = None,
    ) -> AnnotationData | None:
        """Update an existing annotation."""
        # Search all files for the annotation
        for file_path in self.storage_dir.glob("*.json"):
            image_id = file_path.stem
            annotations = self._load_annotations(image_id)

            for i, ann in enumerate(annotations):
                if ann["id"] == annotation_id:
                    if class_id is not None:
                        annotations[i]["class_id"] = class_id
                    if class_name is not None:
                        annotations[i]["class_name"] = class_name
                    self._save_annotations(image_id, annotations)
                    return annotations[i]

        return None

    def delete_annotation(self, annotation_id: str) -> bool:
        """Delete an annotation by ID."""
        for file_path in self.storage_dir.glob("*.json"):
            image_id = file_path.stem
            annotations = self._load_annotations(image_id)

            for i, ann in enumerate(annotations):
                if ann["id"] == annotation_id:
                    annotations.pop(i)
                    self._save_annotations(image_id, annotations)
                    return True

        return False

    def get_all_annotations(self) -> dict[str, list[AnnotationData]]:
        """Get all annotations grouped by image ID."""
        all_annotations: dict[str, list[AnnotationData]] = {}
        for file_path in self.storage_dir.glob("*.json"):
            image_id = file_path.stem
            annotations = self._load_annotations(image_id)
            if annotations:
                all_annotations[image_id] = annotations
        return all_annotations

    def get_annotation_by_id(self, annotation_id: str) -> AnnotationData | None:
        """Find an annotation by its ID across all images."""
        for file_path in self.storage_dir.glob("*.json"):
            image_id = file_path.stem
            annotations = self._load_annotations(image_id)
            for ann in annotations:
                if ann["id"] == annotation_id:
                    return ann
        return None

    def merge_annotations(
        self,
        annotation_ids: list[str],
        class_id: int,
        class_name: str,
    ) -> AnnotationData | None:
        """Merge multiple annotations into one using polygon union.

        Args:
            annotation_ids: List of annotation IDs to merge (must be 2+)
            class_id: Class ID for the merged annotation
            class_name: Class name for the merged annotation

        Returns:
            The merged annotation, or None if annotations not found or from different images
        """
        if len(annotation_ids) < 2:
            return None

        # Collect all annotations
        annotations_to_merge: list[AnnotationData] = []
        for ann_id in annotation_ids:
            ann = self.get_annotation_by_id(ann_id)
            if ann is None:
                return None
            annotations_to_merge.append(ann)

        # Verify all annotations belong to the same image
        image_ids = {ann["image_id"] for ann in annotations_to_merge}
        if len(image_ids) > 1:
            return None
        image_id = annotations_to_merge[0]["image_id"]

        # Convert all segmentations to Shapely polygons and compute union
        all_polygons = []
        for ann in annotations_to_merge:
            for seg in ann["segmentation"]:
                # Convert [x1, y1, x2, y2, ...] to [(x1, y1), (x2, y2), ...]
                coords = [(seg[i], seg[i + 1]) for i in range(0, len(seg), 2)]
                if len(coords) >= 3:
                    poly = Polygon(coords)
                    if poly.is_valid:
                        all_polygons.append(poly)

        if not all_polygons:
            return None

        # Compute union of all polygons
        merged_geom = unary_union(all_polygons)

        # Convert back to segmentation format
        segmentation = self._geometry_to_segmentation(merged_geom)
        if not segmentation:
            return None

        # Calculate bbox and area from merged geometry
        minx, miny, maxx, maxy = merged_geom.bounds
        bbox = [float(minx), float(miny), float(maxx - minx), float(maxy - miny)]
        area = float(merged_geom.area)

        # Delete original annotations
        for ann_id in annotation_ids:
            self.delete_annotation(ann_id)

        # Create new merged annotation
        merged = self.create_annotation(
            image_id=image_id,
            class_id=class_id,
            class_name=class_name,
            segmentation=segmentation,
            bbox=bbox,
            area=area,
        )

        return merged

    def _geometry_to_segmentation(self, geom) -> list[list[float]]:
        """Convert a Shapely geometry to segmentation format."""
        from shapely.geometry import MultiPolygon
        from shapely.geometry import Polygon as ShapelyPolygon

        segmentation: list[list[float]] = []

        if geom.is_empty:
            return segmentation

        # Handle different geometry types
        if isinstance(geom, ShapelyPolygon):
            polygons = [geom]
        elif isinstance(geom, MultiPolygon):
            polygons = list(geom.geoms)
        else:
            # GeometryCollection or other - extract polygons
            polygons = [g for g in getattr(geom, "geoms", []) if isinstance(g, ShapelyPolygon)]

        for poly in polygons:
            # Get exterior ring coordinates
            coords = list(poly.exterior.coords)
            # Flatten to [x1, y1, x2, y2, ...]
            flat_coords = []
            for x, y in coords[:-1]:  # Skip last point (same as first for closed ring)
                flat_coords.extend([float(x), float(y)])
            if len(flat_coords) >= 6:  # At least 3 points
                segmentation.append(flat_coords)

        return segmentation
