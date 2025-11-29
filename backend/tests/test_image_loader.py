from pathlib import Path

import pytest

from app.config import IMAGES_DIR, RAW_ZIP_PATH
from app.utils.image_loader import ImageLoader


@pytest.fixture
def image_loader():
    return ImageLoader(RAW_ZIP_PATH, IMAGES_DIR)


class TestImageLoader:
    def test_extract_images_creates_directory(self, image_loader: ImageLoader, tmp_path: Path):
        loader = ImageLoader(RAW_ZIP_PATH, tmp_path / "images")
        loader.extract_images(limit=1)
        assert (tmp_path / "images").exists()

    def test_extract_images_creates_png_files(self, image_loader: ImageLoader, tmp_path: Path):
        loader = ImageLoader(RAW_ZIP_PATH, tmp_path / "images")
        loader.extract_images(limit=2)
        png_files = list((tmp_path / "images").glob("*.png"))
        assert len(png_files) == 2

    def test_list_images_returns_sorted_list(self, image_loader: ImageLoader, tmp_path: Path):
        loader = ImageLoader(RAW_ZIP_PATH, tmp_path / "images")
        loader.extract_images(limit=3)
        images = loader.list_images()
        assert len(images) == 3
        # Check sorted by slice number
        assert images[0]["id"] < images[1]["id"] < images[2]["id"]

    def test_list_images_includes_metadata(self, image_loader: ImageLoader, tmp_path: Path):
        loader = ImageLoader(RAW_ZIP_PATH, tmp_path / "images")
        loader.extract_images(limit=1)
        images = loader.list_images()
        assert len(images) == 1
        image = images[0]
        assert "id" in image
        assert "filename" in image
        assert "width" in image
        assert "height" in image

    def test_get_image_returns_bytes(self, image_loader: ImageLoader, tmp_path: Path):
        loader = ImageLoader(RAW_ZIP_PATH, tmp_path / "images")
        loader.extract_images(limit=1)
        images = loader.list_images()
        image_id = images[0]["id"]
        image_bytes = loader.get_image(image_id)
        assert image_bytes is not None
        assert len(image_bytes) > 0
        # PNG magic bytes
        assert image_bytes[:8] == b"\x89PNG\r\n\x1a\n"

    def test_get_image_returns_none_for_invalid_id(
        self, image_loader: ImageLoader, tmp_path: Path
    ):
        loader = ImageLoader(RAW_ZIP_PATH, tmp_path / "images")
        loader.extract_images(limit=1)
        image_bytes = loader.get_image("nonexistent")
        assert image_bytes is None

    def test_get_image_info_returns_dimensions(self, image_loader: ImageLoader, tmp_path: Path):
        loader = ImageLoader(RAW_ZIP_PATH, tmp_path / "images")
        loader.extract_images(limit=1)
        images = loader.list_images()
        image_id = images[0]["id"]
        info = loader.get_image_info(image_id)
        assert info is not None
        assert "width" in info
        assert "height" in info
        assert info["width"] > 0
        assert info["height"] > 0
