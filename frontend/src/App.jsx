import { useState, useCallback, useEffect } from 'react';
import {
  ImageCanvas,
  ImageList,
  ClassSelector,
  AnnotationList,
  KeyboardHelp,
  StatusBar,
  ImageAdjustments,
  DEFAULT_CLASSES,
} from './components';
import { useSAM } from './hooks/useSAM';
import { useAnnotations } from './hooks/useAnnotations';
import { useKeyboard } from './hooks/useKeyboard';
import { fetchImageInfo } from './utils/api';
import './styles/App.css';

function App() {
  // State
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [imageInfo, setImageInfo] = useState(null);
  const [selectedClass, setSelectedClass] = useState(1);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [points, setPoints] = useState([]);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [annotationCounts, setAnnotationCounts] = useState({});
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(1);

  // Hooks
  const sam = useSAM();
  const {
    annotations,
    isLoading: annotationsLoading,
    saveAnnotation,
    deleteAnnotation,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useAnnotations(selectedImageId);

  // Update annotation counts
  useEffect(() => {
    if (selectedImageId && annotations) {
      setAnnotationCounts((prev) => ({
        ...prev,
        [selectedImageId]: annotations.length,
      }));
    }
  }, [selectedImageId, annotations]);

  // Load image info when selection changes
  useEffect(() => {
    if (!selectedImageId) {
      setImageInfo(null);
      return;
    }

    fetchImageInfo(selectedImageId)
      .then(setImageInfo)
      .catch(console.error);

    // Reset state for new image
    setPoints([]);
    sam.clearPreview();
    setSelectedAnnotation(null);
  }, [selectedImageId]);

  // Segment when points change
  useEffect(() => {
    if (!selectedImageId || points.length === 0) {
      sam.clearPreview();
      return;
    }

    // Extract existing polygons from annotations to prevent overlaps
    const existingPolygons = annotations?.map((a) => a.segmentation) || null;

    const debounceTimer = setTimeout(() => {
      sam.segment(selectedImageId, points, existingPolygons).catch(console.error);
    }, 100);

    return () => clearTimeout(debounceTimer);
  }, [selectedImageId, points, annotations]);

  // Handlers
  const handleAddPoint = useCallback((point) => {
    setPoints((prev) => [...prev, point]);
  }, []);

  const handleRemoveLastPoint = useCallback(() => {
    setPoints((prev) => prev.slice(0, -1));
  }, []);

  const handleClearPoints = useCallback(() => {
    setPoints([]);
    sam.clearPreview();
  }, [sam]);

  const handleSave = useCallback(async () => {
    if (!sam.preview || points.length === 0) return;

    const classInfo = DEFAULT_CLASSES.find((c) => c.id === selectedClass);

    try {
      await saveAnnotation(
        sam.preview.polygon,
        sam.preview.bbox,
        sam.preview.area,
        selectedClass,
        classInfo?.name || `Class ${selectedClass}`
      );

      // Clear after save
      setPoints([]);
      sam.clearPreview();
    } catch (err) {
      console.error('Failed to save annotation:', err);
    }
  }, [sam.preview, points, selectedClass, saveAnnotation]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedAnnotation) {
      deleteAnnotation(selectedAnnotation);
      setSelectedAnnotation(null);
    }
  }, [selectedAnnotation, deleteAnnotation]);

  const handleSelectImage = useCallback((imageId) => {
    setSelectedImageId(imageId);
    sam.resetEncoder();
  }, [sam]);

  // Keyboard shortcuts
  useKeyboard({
    onSave: handleSave,
    onClear: handleClearPoints,
    onUndo: undo,
    onRedo: redo,
    onNextImage: () => {/* TODO: implement */},
    onPrevImage: () => {/* TODO: implement */},
    onSelectClass: setSelectedClass,
    onToggleHelp: () => setShowHelp((v) => !v),
    onToggleAnnotations: () => setShowAnnotations((v) => !v),
    onDeleteSelected: handleDeleteSelected,
    onRemoveLastPoint: handleRemoveLastPoint,
    enabled: !showHelp,
  });

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <div className="logo">
            <svg viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
              <circle cx="16" cy="16" r="8" stroke="currentColor" strokeWidth="2" opacity="0.6" />
              <circle cx="16" cy="16" r="3" fill="currentColor" />
              <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" />
              <line x1="16" y1="26" x2="16" y2="30" stroke="currentColor" strokeWidth="2" />
              <line x1="2" y1="16" x2="6" y2="16" stroke="currentColor" strokeWidth="2" />
              <line x1="26" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <h1>Cell Labeler</h1>
        </div>
        <div className="header-actions">
          <button
            className="help-button"
            onClick={() => setShowHelp(true)}
            title="Keyboard shortcuts (H)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
        </div>
      </header>

      <main className="app-main">
        <aside className="sidebar sidebar-left">
          <ImageList
            selectedId={selectedImageId}
            onSelect={handleSelectImage}
            annotationCounts={annotationCounts}
          />
        </aside>

        <section className="workspace">
          <ImageCanvas
            imageId={selectedImageId}
            imageInfo={imageInfo}
            annotations={annotations}
            preview={sam.preview}
            points={points}
            onAddPoint={handleAddPoint}
            selectedAnnotation={selectedAnnotation}
            onSelectAnnotation={setSelectedAnnotation}
            showAnnotations={showAnnotations}
            currentClassId={selectedClass}
            brightness={brightness}
            contrast={contrast}
          />
          <StatusBar
            isEncoding={sam.isEncoding}
            isSegmenting={sam.isSegmenting}
            pointCount={points.length}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onClear={handleClearPoints}
            onSave={handleSave}
          />
        </section>

        <aside className="sidebar sidebar-right">
          <ImageAdjustments
            brightness={brightness}
            contrast={contrast}
            onBrightnessChange={setBrightness}
            onContrastChange={setContrast}
            onReset={() => {
              setBrightness(0);
              setContrast(1);
            }}
          />
          <ClassSelector
            selectedClass={selectedClass}
            onSelectClass={setSelectedClass}
            classes={DEFAULT_CLASSES}
          />
          <AnnotationList
            annotations={annotations}
            selectedId={selectedAnnotation}
            onSelect={setSelectedAnnotation}
            onDelete={deleteAnnotation}
            visible={showAnnotations}
            onToggleVisibility={() => setShowAnnotations((v) => !v)}
          />
        </aside>
      </main>

      <KeyboardHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}

export default App;
