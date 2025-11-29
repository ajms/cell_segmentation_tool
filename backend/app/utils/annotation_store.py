import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import TypedDict


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
            "created_at": datetime.now(timezone.utc).isoformat(),
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
