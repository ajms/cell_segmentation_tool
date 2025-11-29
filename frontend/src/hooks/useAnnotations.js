import { useState, useCallback, useEffect } from 'react';
import {
  fetchAnnotations,
  createAnnotation,
  deleteAnnotation as deleteAnnotationApi,
  updateAnnotation as updateAnnotationApi,
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
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
