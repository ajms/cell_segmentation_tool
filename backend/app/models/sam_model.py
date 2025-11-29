import logging
from pathlib import Path
from typing import Protocol

import cv2
import numpy as np
from numpy.typing import NDArray

logger = logging.getLogger(__name__)


class SAMModelProtocol(Protocol):
    """Protocol for SAM model implementations."""

    def set_image(self, image: NDArray[np.uint8]) -> None:
        """Set the image for segmentation."""
        ...

    def predict(
        self,
        point_coords: NDArray[np.float32],
        point_labels: NDArray[np.int32],
    ) -> tuple[NDArray[np.bool_], float]:
        """Predict segmentation mask from points.

        Args:
            point_coords: Array of shape (N, 2) with (x, y) coordinates
            point_labels: Array of shape (N,) with 1 for positive, 0 for negative

        Returns:
            Tuple of (mask, score) where mask is a 2D boolean array
        """
        ...


class SAMModel:
    """Wrapper for SAM2 model."""

    def __init__(self, checkpoint_dir: Path | None = None, model_cfg: str = "sam2.1_hiera_tiny"):
        self.checkpoint_dir = checkpoint_dir
        self.model_cfg = model_cfg
        self._predictor = None
        self._current_image_shape: tuple[int, int] | None = None

    def _load_model(self):
        """Lazy load the SAM2 model."""
        if self._predictor is not None:
            return

        try:
            from sam2.sam2_image_predictor import SAM2ImagePredictor

            self._predictor = SAM2ImagePredictor.from_pretrained(
                f"facebook/{self.model_cfg}",
                cache_dir=self.checkpoint_dir,
            )
            logger.info(f"Loaded SAM2 model: {self.model_cfg}")
        except Exception as e:
            logger.error(f"Failed to load SAM2 model: {e}")
            raise

    def set_image(self, image: NDArray[np.uint8]) -> None:
        """Set the image for segmentation.

        Args:
            image: RGB image array of shape (H, W, 3) or grayscale (H, W)
        """
        self._load_model()

        # Convert grayscale to RGB if needed
        if len(image.shape) == 2:
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
        elif image.shape[2] == 1:
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)

        self._current_image_shape = (image.shape[0], image.shape[1])
        self._predictor.set_image(image)

    def predict(
        self,
        point_coords: NDArray[np.float32],
        point_labels: NDArray[np.int32],
    ) -> tuple[NDArray[np.bool_], float]:
        """Predict segmentation mask from points.

        Args:
            point_coords: Array of shape (N, 2) with (x, y) coordinates
            point_labels: Array of shape (N,) with 1 for positive, 0 for negative

        Returns:
            Tuple of (mask, score) where mask is a 2D boolean array
        """
        if self._predictor is None:
            raise RuntimeError("Model not loaded. Call set_image first.")

        masks, scores, _ = self._predictor.predict(
            point_coords=point_coords,
            point_labels=point_labels,
            multimask_output=True,
        )

        # Return the mask with the highest score
        best_idx = np.argmax(scores)
        return masks[best_idx], float(scores[best_idx])


class MockSAMModel:
    """Mock SAM model for testing without GPU."""

    def __init__(self):
        self._current_image_shape: tuple[int, int] | None = None

    def set_image(self, image: NDArray[np.uint8]) -> None:
        """Set the image shape for generating mock masks."""
        if len(image.shape) == 2:
            self._current_image_shape = (image.shape[0], image.shape[1])
        else:
            self._current_image_shape = (image.shape[0], image.shape[1])

    def predict(
        self,
        point_coords: NDArray[np.float32],
        point_labels: NDArray[np.int32],
    ) -> tuple[NDArray[np.bool_], float]:
        """Generate a mock circular mask around the first positive point."""
        if self._current_image_shape is None:
            raise RuntimeError("Image not set. Call set_image first.")

        h, w = self._current_image_shape
        mask = np.zeros((h, w), dtype=bool)

        # Find first positive point
        positive_points = point_coords[point_labels == 1]
        if len(positive_points) > 0:
            cx, cy = positive_points[0].astype(int)
            # Create a circular mask
            radius = min(50, h // 10, w // 10)
            y, x = np.ogrid[:h, :w]
            circle_mask = (x - cx) ** 2 + (y - cy) ** 2 <= radius**2
            mask = circle_mask

        return mask, 0.95


# Global model instance - will be set at startup
_sam_model: SAMModelProtocol | None = None


def get_sam_model() -> SAMModelProtocol:
    """Get the global SAM model instance."""
    global _sam_model
    if _sam_model is None:
        raise RuntimeError("SAM model not initialized")
    return _sam_model


def set_sam_model(model: SAMModelProtocol) -> None:
    """Set the global SAM model instance."""
    global _sam_model
    _sam_model = model


def initialize_sam_model(use_mock: bool = False, checkpoint_dir: Path | None = None) -> None:
    """Initialize the SAM model.

    Args:
        use_mock: If True, use mock model for testing
        checkpoint_dir: Directory for model checkpoints
    """
    global _sam_model
    if use_mock:
        _sam_model = MockSAMModel()
        logger.info("Initialized mock SAM model")
    else:
        _sam_model = SAMModel(checkpoint_dir=checkpoint_dir)
        logger.info("Initialized SAM2 model")
