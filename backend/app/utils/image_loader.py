import re
import zipfile
from io import BytesIO
from pathlib import Path
from typing import TypedDict

from PIL import Image


class ImageMetadata(TypedDict):
    id: str
    filename: str
    width: int
    height: int


class ImageInfo(TypedDict):
    id: str
    width: int
    height: int


class ImageLoader:
    """Handles extraction and loading of images from the raw data zip file."""

    def __init__(self, zip_path: Path, output_dir: Path):
        self.zip_path = zip_path
        self.output_dir = output_dir
        self._image_cache: dict[str, ImageMetadata] = {}

    def extract_images(self, limit: int | None = None) -> int:
        """Extract TIFF images from zip and convert to PNG.

        Args:
            limit: Maximum number of images to extract (None for all)

        Returns:
            Number of images extracted
        """
        self.output_dir.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(self.zip_path, "r") as zf:
            tiff_files = sorted(
                [f for f in zf.namelist() if f.lower().endswith((".tif", ".tiff"))]
            )

            if limit:
                tiff_files = tiff_files[:limit]

            for tiff_name in tiff_files:
                # Generate image ID from filename
                image_id = self._generate_image_id(tiff_name)
                png_path = self.output_dir / f"{image_id}.png"

                if png_path.exists():
                    continue

                # Extract and convert
                with zf.open(tiff_name) as tiff_file:
                    img = Image.open(tiff_file)
                    img.save(png_path, "PNG")

        self._refresh_cache()
        return len(tiff_files)

    def _generate_image_id(self, filename: str) -> str:
        """Generate a unique ID from the filename.

        Extracts the slice number from filenames like '52_G2_t0_110ms_0500.rec.8bit.tif'
        """
        match = re.search(r"_(\d{4})\.", filename)
        if match:
            return f"slice_{match.group(1)}"
        # Fallback: use filename without extension
        return Path(filename).stem.replace(".", "_")

    def _refresh_cache(self) -> None:
        """Refresh the internal cache of image metadata."""
        self._image_cache.clear()

        if not self.output_dir.exists():
            return

        for png_path in sorted(self.output_dir.glob("*.png")):
            image_id = png_path.stem
            with Image.open(png_path) as img:
                self._image_cache[image_id] = {
                    "id": image_id,
                    "filename": png_path.name,
                    "width": img.width,
                    "height": img.height,
                }

    def list_images(self) -> list[ImageMetadata]:
        """List all available images with metadata.

        Returns:
            List of image metadata dictionaries
        """
        if not self._image_cache:
            self._refresh_cache()

        return sorted(self._image_cache.values(), key=lambda x: x["id"])

    def get_image(self, image_id: str) -> bytes | None:
        """Get image bytes by ID.

        Args:
            image_id: The unique image identifier

        Returns:
            PNG image bytes or None if not found
        """
        png_path = self.output_dir / f"{image_id}.png"
        if not png_path.exists():
            return None

        return png_path.read_bytes()

    def get_image_info(self, image_id: str) -> ImageInfo | None:
        """Get image dimensions by ID.

        Args:
            image_id: The unique image identifier

        Returns:
            Image info dict or None if not found
        """
        if not self._image_cache:
            self._refresh_cache()

        if image_id not in self._image_cache:
            return None

        meta = self._image_cache[image_id]
        return {"id": image_id, "width": meta["width"], "height": meta["height"]}

    def get_image_path(self, image_id: str) -> Path | None:
        """Get the filesystem path for an image.

        Args:
            image_id: The unique image identifier

        Returns:
            Path to the PNG file or None if not found
        """
        png_path = self.output_dir / f"{image_id}.png"
        if not png_path.exists():
            return None
        return png_path
