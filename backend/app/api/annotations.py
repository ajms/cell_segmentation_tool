from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.config import ANNOTATIONS_DIR
from app.utils.annotation_store import AnnotationStore

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


class Annotation(BaseModel):
    id: str
    image_id: str
    class_id: int
    class_name: str
    segmentation: list[list[float]]
    bbox: list[float]
    area: float
    created_at: str


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
