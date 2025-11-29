import cv2
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.images import image_loader
from app.models.sam_model import get_sam_model

router = APIRouter(prefix="/sam", tags=["sam"])

# Cache for encoded images
_encoded_images: dict[str, bool] = {}


class EncodeResponse(BaseModel):
    status: str
    image_id: str


class Point(BaseModel):
    x: float
    y: float
    is_positive: bool = True


class SegmentRequest(BaseModel):
    image_id: str
    points: list[Point]
    existing_polygons: list[list[list[float]]] | None = None  # Polygons to exclude


class SegmentResponse(BaseModel):
    polygon: list[list[float]]  # List of polygons [[x1,y1,x2,y2,...], ...]
    bbox: list[float]  # [x, y, width, height]
    area: float
    score: float


@router.post("/encode/{image_id}", response_model=EncodeResponse)
async def encode_image(image_id: str) -> EncodeResponse:
    """Encode an image for SAM segmentation.

    This caches the image embedding for faster repeated inference.
    """
    image_path = image_loader.get_image_path(image_id)
    if image_path is None:
        raise HTTPException(status_code=404, detail=f"Image '{image_id}' not found")

    # Load image
    image = cv2.imread(str(image_path))
    if image is None:
        raise HTTPException(status_code=500, detail=f"Failed to load image '{image_id}'")

    # Convert BGR to RGB
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # Set image in SAM model
    sam_model = get_sam_model()
    sam_model.set_image(image)

    # Mark as encoded
    _encoded_images[image_id] = True

    return EncodeResponse(status="encoded", image_id=image_id)


@router.post("/segment", response_model=SegmentResponse)
async def segment(request: SegmentRequest) -> SegmentResponse:
    """Generate segmentation mask from click points.

    The image must be encoded first using the /encode endpoint.
    """
    if request.image_id not in _encoded_images:
        raise HTTPException(
            status_code=400,
            detail=f"Image '{request.image_id}' not encoded. Call /encode first.",
        )

    if len(request.points) == 0:
        raise HTTPException(status_code=400, detail="At least one point is required")

    # Prepare points for SAM
    point_coords = np.array([[p.x, p.y] for p in request.points], dtype=np.float32)
    point_labels = np.array([1 if p.is_positive else 0 for p in request.points], dtype=np.int32)

    # Get prediction
    sam_model = get_sam_model()
    mask, score = sam_model.predict(point_coords, point_labels)

    # Exclude existing polygons from the mask
    if request.existing_polygons:
        print(f"DEBUG: mask.shape={mask.shape}, points={[(p.x, p.y) for p in request.points]}")
        print(f"DEBUG: Received {len(request.existing_polygons)} existing annotations")
        # Check first polygon coords
        if request.existing_polygons and request.existing_polygons[0]:
            first_poly = request.existing_polygons[0][0][:8] if request.existing_polygons[0] else []
            print(f"DEBUG: First polygon coords (first 8): {first_poly}")
        exclusion_mask = polygons_to_mask(request.existing_polygons, mask.shape)
        excluded_pixels = int(np.sum(exclusion_mask))
        print(f"DEBUG: Exclusion mask has {excluded_pixels} pixels, SAM mask has {int(np.sum(mask))} pixels")
        # Check overlap
        overlap = int(np.sum(mask & exclusion_mask))
        print(f"DEBUG: Overlap between SAM and exclusion: {overlap} pixels")
        mask = mask & ~exclusion_mask
        print(f"DEBUG: After exclusion, mask has {int(np.sum(mask))} pixels")

    # Convert mask to polygon
    polygons = mask_to_polygons(mask)

    # Calculate bounding box and area
    bbox = calculate_bbox(mask)
    area = float(np.sum(mask))

    return SegmentResponse(
        polygon=polygons,
        bbox=bbox,
        area=area,
        score=score,
    )


def mask_to_polygons(mask: np.ndarray) -> list[list[float]]:
    """Convert binary mask to polygon coordinates.

    Args:
        mask: Binary mask array of shape (H, W)

    Returns:
        List of polygons, each as [x1, y1, x2, y2, ...]
    """
    mask_uint8 = mask.astype(np.uint8) * 255
    contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    polygons = []
    for contour in contours:
        # Simplify contour to reduce points
        epsilon = 0.005 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)

        if len(approx) >= 3:  # Need at least 3 points for a polygon
            # Flatten to [x1, y1, x2, y2, ...]
            polygon = approx.flatten().astype(float).tolist()
            polygons.append(polygon)

    return polygons


def calculate_bbox(mask: np.ndarray) -> list[float]:
    """Calculate bounding box from binary mask.

    Args:
        mask: Binary mask array of shape (H, W)

    Returns:
        [x, y, width, height]
    """
    if not np.any(mask):
        return [0.0, 0.0, 0.0, 0.0]

    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    y_min, y_max = np.where(rows)[0][[0, -1]]
    x_min, x_max = np.where(cols)[0][[0, -1]]

    return [float(x_min), float(y_min), float(x_max - x_min + 1), float(y_max - y_min + 1)]


def polygons_to_mask(
    polygons: list[list[list[float]]], shape: tuple[int, int]
) -> np.ndarray:
    """Convert list of annotation polygons to binary exclusion mask.

    Args:
        polygons: List of annotations, each containing list of polygon coords [x1,y1,x2,y2,...]
        shape: (height, width) of the output mask

    Returns:
        Binary mask where True indicates existing annotations
    """
    mask = np.zeros(shape, dtype=np.uint8)

    for annotation_polygons in polygons:
        for polygon_coords in annotation_polygons:
            # Convert [x1,y1,x2,y2,...] to array of points [[x1,y1], [x2,y2], ...]
            coords = np.array(polygon_coords, dtype=np.float32)
            if len(coords) < 6:  # Need at least 3 points (6 values)
                continue
            points = coords.reshape(-1, 2).astype(np.int32)
            cv2.fillPoly(mask, [points], 1)

    return mask > 0
