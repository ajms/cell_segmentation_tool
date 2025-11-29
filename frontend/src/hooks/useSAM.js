import { useState, useCallback, useRef } from 'react';
import { encodeImage, segmentImage } from '../utils/api';

export function useSAM() {
  const [isEncoding, setIsEncoding] = useState(false);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const encodedImageRef = useRef(null);

  const encode = useCallback(async (imageId) => {
    if (encodedImageRef.current === imageId) {
      return; // Already encoded
    }

    setIsEncoding(true);
    setError(null);

    try {
      await encodeImage(imageId);
      encodedImageRef.current = imageId;
    } catch (err) {
      setError(err.message || 'Failed to encode image');
      throw err;
    } finally {
      setIsEncoding(false);
    }
  }, []);

  const segment = useCallback(async (imageId, points, existingPolygons = null) => {
    if (points.length === 0) {
      setPreview(null);
      return null;
    }

    setIsSegmenting(true);
    setError(null);

    try {
      // Ensure image is encoded
      if (encodedImageRef.current !== imageId) {
        await encode(imageId);
      }

      const result = await segmentImage(imageId, points, existingPolygons);
      setPreview(result);
      return result;
    } catch (err) {
      setError(err.message || 'Failed to segment');
      throw err;
    } finally {
      setIsSegmenting(false);
    }
  }, [encode]);

  const clearPreview = useCallback(() => {
    setPreview(null);
  }, []);

  const resetEncoder = useCallback(() => {
    encodedImageRef.current = null;
    setPreview(null);
  }, []);

  return {
    isEncoding,
    isSegmenting,
    preview,
    error,
    encode,
    segment,
    clearPreview,
    resetEncoder,
  };
}
