from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.config import ANNOTATIONS_DIR
from app.utils.annotation_store import AnnotationStore
from app.utils.point_generator import generate_negative_points, generate_positive_points

router = APIRouter(prefix="/annotations", tags=["annotations"])

# Initialize annotation store
annotation_store = AnnotationStore(ANNOTATIONS_DIR)


class AnnotationCreate(BaseModel):
    class_id: int
    class_name: str
    segmentation: list[list[float]]
    bbox: list[float]
    area: float


class AnnotationUpdate(BaseModel):
    class_id: int | None = None
    class_name: str | None = None


class MergeRequest(BaseModel):
    annotation_ids: list[str]
    class_id: int
    class_name: str


class BrushModifyRequest(BaseModel):
    brush_path: list[tuple[float, float]]
    brush_radius: float
    operation: Literal["add", "remove"]


class Annotation(BaseModel):
    id: str
    image_id: str
    class_id: int
    class_name: str
    segmentation: list[list[float]]
    bbox: list[float]
    area: float
    created_at: str


class PointData(BaseModel):
    x: float
    y: float
    is_positive: bool


class GeneratePointsRequest(BaseModel):
    segmentation: list[list[float]]
    bbox: list[float]
    positive_count: int = 2
    negative_count: int = 1


class GeneratePointsResponse(BaseModel):
    positive_points: list[PointData]
    negative_points: list[PointData]


@router.post("/generate-points", response_model=GeneratePointsResponse)
async def generate_transfer_points(request: GeneratePointsRequest) -> GeneratePointsResponse:
    """Generate positive and negative points for label transfer.

    Given a polygon segmentation and bounding box, generates points that can be
    used to re-segment the same region on a different slice using SAM.

    - Positive points are placed inside the polygon (centroid-based)
    - Negative points are placed just outside the bounding box
    """
    # Validate counts
    if not 1 <= request.positive_count <= 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="positive_count must be between 1 and 3",
        )
    if not 0 <= request.negative_count <= 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="negative_count must be between 0 and 3",
        )

    # Validate segmentation
    if not request.segmentation or not request.segmentation[0]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="segmentation cannot be empty",
        )

    # Use the first polygon (largest/primary) for point generation
    polygon_coords = request.segmentation[0]

    positive = generate_positive_points(polygon_coords, request.positive_count)
    negative = generate_negative_points(request.bbox, polygon_coords, request.negative_count)

    return GeneratePointsResponse(
        positive_points=[PointData(**p) for p in positive],
        negative_points=[PointData(**p) for p in negative],
    )


@router.post("/merge", response_model=Annotation, status_code=status.HTTP_201_CREATED)
async def merge_annotations(request: MergeRequest) -> Annotation:
    """Merge multiple annotations into one using polygon union."""
    if len(request.annotation_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 2 annotations are required to merge",
        )

    # Check if all annotations exist
    for ann_id in request.annotation_ids:
        if annotation_store.get_annotation_by_id(ann_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Annotation '{ann_id}' not found",
            )

    # Check if all annotations belong to the same image
    image_ids = set()
    for ann_id in request.annotation_ids:
        ann = annotation_store.get_annotation_by_id(ann_id)
        if ann:
            image_ids.add(ann["image_id"])
    if len(image_ids) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All annotations must belong to the same image",
        )

    merged = annotation_store.merge_annotations(
        annotation_ids=request.annotation_ids,
        class_id=request.class_id,
        class_name=request.class_name,
    )

    if merged is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to merge annotations",
        )

    return Annotation(**merged)


@router.get("/{image_id}", response_model=list[Annotation])
async def get_annotations(image_id: str) -> list[Annotation]:
    """Get all annotations for an image."""
    annotations = annotation_store.get_annotations(image_id)
    return [Annotation(**ann) for ann in annotations]


@router.post("/{image_id}", response_model=Annotation, status_code=status.HTTP_201_CREATED)
async def create_annotation(image_id: str, data: AnnotationCreate) -> Annotation:
    """Create a new annotation for an image."""
    annotation = annotation_store.create_annotation(
        image_id=image_id,
        class_id=data.class_id,
        class_name=data.class_name,
        segmentation=data.segmentation,
        bbox=data.bbox,
        area=data.area,
    )
    return Annotation(**annotation)


@router.put("/{annotation_id}", response_model=Annotation)
async def update_annotation(annotation_id: str, data: AnnotationUpdate) -> Annotation:
    """Update an existing annotation."""
    annotation = annotation_store.update_annotation(
        annotation_id=annotation_id,
        class_id=data.class_id,
        class_name=data.class_name,
    )
    if annotation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotation '{annotation_id}' not found",
        )
    return Annotation(**annotation)


@router.delete("/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_annotation(annotation_id: str) -> None:
    """Delete an annotation."""
    deleted = annotation_store.delete_annotation(annotation_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotation '{annotation_id}' not found",
        )


@router.patch("/{annotation_id}/brush", response_model=Annotation)
async def apply_brush(annotation_id: str, data: BrushModifyRequest) -> Annotation:
    """Apply a brush stroke to modify an annotation's geometry.

    Use operation="add" to expand the annotation (fill holes, extend edges).
    Use operation="remove" to shrink the annotation (trim edges, create holes).
    """
    if not data.brush_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brush path cannot be empty",
        )

    if data.brush_radius <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brush radius must be positive",
        )

    # Check if annotation exists
    if annotation_store.get_annotation_by_id(annotation_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotation '{annotation_id}' not found",
        )

    result = annotation_store.apply_brush_to_annotation(
        annotation_id=annotation_id,
        brush_path=data.brush_path,
        brush_radius=data.brush_radius,
        operation=data.operation,
    )

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to apply brush operation (annotation may be fully erased)",
        )

    return Annotation(**result)
