from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.config import IMAGES_DIR, RAW_ZIP_PATH
from app.models.schemas import ImageInfo, ImageMetadata
from app.utils.image_loader import ImageLoader

router = APIRouter(prefix="/images", tags=["images"])

# Initialize image loader and extract images on startup
image_loader = ImageLoader(RAW_ZIP_PATH, IMAGES_DIR)

# Extract images if not already done (only first 100 for now)
if RAW_ZIP_PATH.exists():
    image_loader.extract_images()


@router.get("", response_model=list[ImageMetadata])
async def list_images() -> list[ImageMetadata]:
    """List all available images with metadata."""
    images = image_loader.list_images()
    return [ImageMetadata(**img) for img in images]


@router.get("/{image_id}")
async def get_image(image_id: str) -> Response:
    """Get a specific image by ID."""
    image_bytes = image_loader.get_image(image_id)
    if image_bytes is None:
        raise HTTPException(status_code=404, detail=f"Image '{image_id}' not found")

    return Response(content=image_bytes, media_type="image/png")


@router.get("/{image_id}/info", response_model=ImageInfo)
async def get_image_info(image_id: str) -> ImageInfo:
    """Get image dimensions and metadata."""
    info = image_loader.get_image_info(image_id)
    if info is None:
        raise HTTPException(status_code=404, detail=f"Image '{image_id}' not found")

    return ImageInfo(**info)
