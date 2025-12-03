import { useState, useCallback, useEffect, useMemo } from 'react';
import { fetchAnnotations, generateTransferPoints } from '../utils/api';

const STORAGE_KEY = 'transfer-settings';
const DEFAULT_SETTINGS = {
  positivePoints: 2,
  negativePoints: 1,
};

/**
 * Hook for managing label transfer between slices.
 *
 * Allows transferring annotations from the previous slice to the current slice
 * using SAM-based re-segmentation with auto-generated points.
 *
 * @param {string} currentImageId - Current image/slice ID
 * @param {Array} images - Array of all images (sorted by ID)
 * @param {Function} sam - useSAM hook instance for running segmentation
 * @param {Array} existingAnnotations - Current annotations on the current slice
 */
export function useTransfer(currentImageId, images, sam, existingAnnotations) {
  // Load settings from localStorage
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Transfer state
  const [isActive, setIsActive] = useState(false);
  const [sourceAnnotations, setSourceAnnotations] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [confirmedPreviews, setConfirmedPreviews] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [transferPoints, setTransferPoints] = useState(null);

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }, [settings]);

  // Get previous image ID
  const previousImageId = useMemo(() => {
    if (!currentImageId || !images || images.length === 0) return null;
    const currentIdx = images.findIndex((img) => img.id === currentImageId);
    if (currentIdx <= 0) return null;
    return images[currentIdx - 1].id;
  }, [currentImageId, images]);

  // Check if transfer is possible
  const canStartTransfer = useMemo(() => {
    return !!previousImageId && !isActive;
  }, [previousImageId, isActive]);

  // Current annotation being transferred
  const currentAnnotation = useMemo(() => {
    if (!isActive || sourceAnnotations.length === 0) return null;
    return sourceAnnotations[currentIndex] || null;
  }, [isActive, sourceAnnotations, currentIndex]);

  // Update settings
  const updateSettings = useCallback((newSettings) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  // Generate points for current annotation and run SAM
  const generateAndSegment = useCallback(async (annotation) => {
    if (!currentImageId || !annotation) return;

    setIsLoading(true);
    setError(null);

    try {
      // Generate points from the source annotation's polygon
      const pointsData = await generateTransferPoints(
        annotation.segmentation,
        annotation.bbox,
        settings.positivePoints,
        settings.negativePoints
      );

      // Combine positive and negative points
      const allPoints = [
        ...pointsData.positive_points,
        ...pointsData.negative_points,
      ];

      setTransferPoints(allPoints);

      // Get existing polygons to avoid overlap
      const existingPolygons = existingAnnotations?.map((a) => a.segmentation) || [];
      // Add confirmed previews to existing
      confirmedPreviews.forEach((p) => {
        if (p.polygon) {
          existingPolygons.push(p.polygon);
        }
      });

      // Run SAM segmentation on current image with generated points
      await sam.segment(currentImageId, allPoints, existingPolygons.length > 0 ? existingPolygons : null);
    } catch (err) {
      setError(err.message || 'Failed to generate segmentation');
      setTransferPoints(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentImageId, settings, sam, existingAnnotations, confirmedPreviews]);

  // Start transfer workflow
  const startTransfer = useCallback(async () => {
    if (!previousImageId) {
      setError('No previous slice available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Load annotations from previous slice
      const prevAnnotations = await fetchAnnotations(previousImageId);

      if (prevAnnotations.length === 0) {
        setError('Previous slice has no annotations');
        setIsLoading(false);
        return;
      }

      setSourceAnnotations(prevAnnotations);
      setCurrentIndex(0);
      setConfirmedPreviews([]);
      setIsActive(true);

      // Generate points and run SAM for first annotation
      await generateAndSegment(prevAnnotations[0]);
    } catch (err) {
      setError(err.message || 'Failed to start transfer');
    } finally {
      setIsLoading(false);
    }
  }, [previousImageId, generateAndSegment]);

  // Confirm current preview
  const confirmCurrent = useCallback(() => {
    if (!sam.preview || !currentAnnotation) return;

    // Store confirmed preview with source annotation metadata
    setConfirmedPreviews((prev) => [
      ...prev,
      {
        ...sam.preview,
        classId: currentAnnotation.class_id,
        className: currentAnnotation.class_name,
        sourceId: currentAnnotation.id,
      },
    ]);

    // Move to next annotation
    if (currentIndex < sourceAnnotations.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      generateAndSegment(sourceAnnotations[nextIndex]);
    } else {
      // All annotations processed
      sam.clearPreview();
      setTransferPoints(null);
    }
  }, [sam, currentAnnotation, currentIndex, sourceAnnotations, generateAndSegment]);

  // Skip current annotation
  const skipCurrent = useCallback(() => {
    if (currentIndex < sourceAnnotations.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      generateAndSegment(sourceAnnotations[nextIndex]);
    } else {
      // All annotations processed
      sam.clearPreview();
      setTransferPoints(null);
    }
  }, [currentIndex, sourceAnnotations, generateAndSegment, sam]);

  // Go to previous annotation
  const prevAnnotation = useCallback(() => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      generateAndSegment(sourceAnnotations[prevIndex]);
    }
  }, [currentIndex, sourceAnnotations, generateAndSegment]);

  // Remove a confirmed preview
  const removeConfirmed = useCallback((index) => {
    setConfirmedPreviews((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Cancel transfer
  const cancelTransfer = useCallback(() => {
    setIsActive(false);
    setSourceAnnotations([]);
    setCurrentIndex(0);
    setConfirmedPreviews([]);
    setTransferPoints(null);
    setError(null);
    sam.clearPreview();
  }, [sam]);

  // Re-generate when settings change during active transfer
  useEffect(() => {
    if (isActive && currentAnnotation && !isLoading) {
      generateAndSegment(currentAnnotation);
    }
  }, [settings.positivePoints, settings.negativePoints]);

  return {
    // State
    isActive,
    isLoading,
    error,
    sourceAnnotations,
    currentIndex,
    currentAnnotation,
    confirmedPreviews,
    settings,
    transferPoints,
    canStartTransfer,
    previousImageId,

    // Actions
    startTransfer,
    confirmCurrent,
    skipCurrent,
    prevAnnotation,
    removeConfirmed,
    cancelTransfer,
    updateSettings,

    // Computed
    hasMoreAnnotations: currentIndex < sourceAnnotations.length - 1,
    allProcessed: isActive && currentIndex >= sourceAnnotations.length - 1 && !sam.preview,
    confirmedCount: confirmedPreviews.length,
    totalCount: sourceAnnotations.length,
  };
}
