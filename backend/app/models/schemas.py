from pydantic import BaseModel


class ImageMetadata(BaseModel):
    id: str
    filename: str
    width: int
    height: int


class ImageInfo(BaseModel):
    id: str
    width: int
    height: int


class Point(BaseModel):
    x: float
    y: float
    is_positive: bool = True


class SegmentRequest(BaseModel):
    image_id: str
    points: list[Point]


class SegmentResponse(BaseModel):
    mask: list[list[int]]  # Binary mask as 2D array
    polygon: list[list[float]]  # Polygon coordinates [[x1,y1,x2,y2,...], ...]
    bbox: list[float]  # [x, y, width, height]
    area: float


class AnnotationCreate(BaseModel):
    class_id: int
    class_name: str
    segmentation: list[list[float]]  # Polygon coordinates
    bbox: list[float]
    area: float


class Annotation(BaseModel):
    id: str
    image_id: str
    class_id: int
    class_name: str
    segmentation: list[list[float]]
    bbox: list[float]
    area: float
    created_at: str


class AnnotationUpdate(BaseModel):
    class_id: int | None = None
    class_name: str | None = None


class ExportRequest(BaseModel):
    include_unlabeled: bool = False


class HealthResponse(BaseModel):
    status: str
