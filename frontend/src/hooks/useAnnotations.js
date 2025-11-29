import { useState, useCallback, useEffect } from 'react';
import {
  fetchAnnotations,
  createAnnotation,
  deleteAnnotation as deleteAnnotationApi,
  updateAnnotation as updateAnnotationApi,
  mergeAnnotations as mergeAnnotationsApi,
} from '../utils/api';

export function useAnnotations(imageId) {
  const [annotations, setAnnotations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Load annotations when image changes
  useEffect(() => {
    if (!imageId) {
      setAnnotations([]);
      return;
    }

    const loadAnnotations = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchAnnotations(imageId);
        setAnnotations(data);
        // Clear undo/redo stack on image change
        setUndoStack([]);
        setRedoStack([]);
      } catch (err) {
        setError(err.message || 'Failed to load annotations');
      } finally {
        setIsLoading(false);
      }
    };

    loadAnnotations();
  }, [imageId]);

  const saveAnnotation = useCallback(
    async (segmentation, bbox, area, classId, className) => {
      if (!imageId) return null;

      try {
        const annotation = await createAnnotation(imageId, {
          class_id: classId,
          class_name: className,
          segmentation,
          bbox,
          area,
        });

        setAnnotations((prev) => [...prev, annotation]);

        // Add to undo stack
        setUndoStack((prev) => [
          ...prev,
          { type: 'create', annotation },
        ]);
        setRedoStack([]);

        return annotation;
      } catch (err) {
        setError(err.message || 'Failed to save annotation');
        throw err;
      }
    },
    [imageId]
  );

  const deleteAnnotation = useCallback(async (annotationId) => {
    const annotation = annotations.find((a) => a.id === annotationId);
    if (!annotation) return;

    try {
      await deleteAnnotationApi(annotationId);
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));

      // Add to undo stack
      setUndoStack((prev) => [
        ...prev,
        { type: 'delete', annotation },
      ]);
      setRedoStack([]);
    } catch (err) {
      setError(err.message || 'Failed to delete annotation');
      throw err;
    }
  }, [annotations]);

  const updateAnnotation = useCallback(async (annotationId, data) => {
    const oldAnnotation = annotations.find((a) => a.id === annotationId);
    if (!oldAnnotation) return;

    try {
      const updated = await updateAnnotationApi(annotationId, data);
      setAnnotations((prev) =>
        prev.map((a) => (a.id === annotationId ? updated : a))
      );

      // Add to undo stack
      setUndoStack((prev) => [
        ...prev,
        { type: 'update', oldAnnotation, newAnnotation: updated },
      ]);
      setRedoStack([]);

      return updated;
    } catch (err) {
      setError(err.message || 'Failed to update annotation');
      throw err;
    }
  }, [annotations]);

  const mergeAnnotations = useCallback(async (annotationIds, classId, className) => {
    if (!imageId || annotationIds.length < 2) return null;

    // Store the annotations being merged for undo
    const mergedAnnotations = annotations.filter((a) => annotationIds.includes(a.id));

    try {
      const merged = await mergeAnnotationsApi(annotationIds, classId, className);

      // Remove old annotations and add merged one
      setAnnotations((prev) => [
        ...prev.filter((a) => !annotationIds.includes(a.id)),
        merged,
      ]);

      // Add to undo stack
      setUndoStack((prev) => [
        ...prev,
        { type: 'merge', mergedAnnotations, newAnnotation: merged },
      ]);
      setRedoStack([]);

      return merged;
    } catch (err) {
      setError(err.message || 'Failed to merge annotations');
      throw err;
    }
  }, [imageId, annotations]);

  const undo = useCallback(async () => {
    if (undoStack.length === 0) return;

    const action = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    try {
      if (action.type === 'create') {
        // Undo create = delete
        await deleteAnnotationApi(action.annotation.id);
        setAnnotations((prev) =>
          prev.filter((a) => a.id !== action.annotation.id)
        );
      } else if (action.type === 'delete') {
        // Undo delete = recreate
        const annotation = await createAnnotation(imageId, {
          class_id: action.annotation.class_id,
          class_name: action.annotation.class_name,
          segmentation: action.annotation.segmentation,
          bbox: action.annotation.bbox,
          area: action.annotation.area,
        });
        setAnnotations((prev) => [...prev, annotation]);
        // Update action with new annotation for redo
        action.annotation = annotation;
      } else if (action.type === 'update') {
        // Undo update = restore old values
        const updated = await updateAnnotationApi(action.newAnnotation.id, {
          class_id: action.oldAnnotation.class_id,
          class_name: action.oldAnnotation.class_name,
        });
        setAnnotations((prev) =>
          prev.map((a) => (a.id === action.newAnnotation.id ? updated : a))
        );
      } else if (action.type === 'merge') {
        // Undo merge = delete merged, recreate originals
        await deleteAnnotationApi(action.newAnnotation.id);
        const recreated = [];
        for (const ann of action.mergedAnnotations) {
          const newAnn = await createAnnotation(imageId, {
            class_id: ann.class_id,
            class_name: ann.class_name,
            segmentation: ann.segmentation,
            bbox: ann.bbox,
            area: ann.area,
          });
          recreated.push(newAnn);
        }
        setAnnotations((prev) => [
          ...prev.filter((a) => a.id !== action.newAnnotation.id),
          ...recreated,
        ]);
        action.mergedAnnotations = recreated;
      }

      setRedoStack((prev) => [...prev, action]);
    } catch (err) {
      setError(err.message || 'Failed to undo');
    }
  }, [undoStack, imageId]);

  const redo = useCallback(async () => {
    if (redoStack.length === 0) return;

    const action = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));

    try {
      if (action.type === 'create') {
        // Redo create = recreate
        const annotation = await createAnnotation(imageId, {
          class_id: action.annotation.class_id,
          class_name: action.annotation.class_name,
          segmentation: action.annotation.segmentation,
          bbox: action.annotation.bbox,
          area: action.annotation.area,
        });
        setAnnotations((prev) => [...prev, annotation]);
        action.annotation = annotation;
      } else if (action.type === 'delete') {
        // Redo delete = delete again
        await deleteAnnotationApi(action.annotation.id);
        setAnnotations((prev) =>
          prev.filter((a) => a.id !== action.annotation.id)
        );
      } else if (action.type === 'update') {
        // Redo update = apply new values
        const updated = await updateAnnotationApi(action.oldAnnotation.id, {
          class_id: action.newAnnotation.class_id,
          class_name: action.newAnnotation.class_name,
        });
        setAnnotations((prev) =>
          prev.map((a) => (a.id === action.oldAnnotation.id ? updated : a))
        );
      } else if (action.type === 'merge') {
        // Redo merge = delete originals, merge again
        const annotationIds = action.mergedAnnotations.map((a) => a.id);
        const merged = await mergeAnnotationsApi(
          annotationIds,
          action.newAnnotation.class_id,
          action.newAnnotation.class_name
        );
        setAnnotations((prev) => [
          ...prev.filter((a) => !annotationIds.includes(a.id)),
          merged,
        ]);
        action.newAnnotation = merged;
      }

      setUndoStack((prev) => [...prev, action]);
    } catch (err) {
      setError(err.message || 'Failed to redo');
    }
  }, [redoStack, imageId]);

  return {
    annotations,
    isLoading,
    error,
    saveAnnotation,
    deleteAnnotation,
    updateAnnotation,
    mergeAnnotations,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
