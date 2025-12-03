import { useState, useCallback, useEffect } from 'react';
import {
  ImageCanvas,
  ImageList,
  ClassSelector,
  AnnotationList,
  KeyboardHelp,
  StatusBar,
  ImageAdjustments,
  TransferPanel,
  DEFAULT_CLASSES,
} from './components';
import { useSAM } from './hooks/useSAM';
import { useAnnotations } from './hooks/useAnnotations';
import { useKeyboard } from './hooks/useKeyboard';
import { useTransfer } from './hooks/useTransfer';
import { fetchImageInfo } from './utils/api';
import './styles/App.css';

function App() {
  // State
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [imageInfo, setImageInfo] = useState(null);
  const [selectedClass, setSelectedClass] = useState(1);
  const [selectedAnnotations, setSelectedAnnotations] = useState([]);
  const [mode, setMode] = useState('segment'); // 'segment' or 'select'
  const [points, setPoints] = useState([]);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [tool, setTool] = useState('pointer'); // 'pointer' or 'brush'
  const [brushMode, setBrushMode] = useState('add'); // 'add' or 'remove'
  const [brushSize, setBrushSize] = useState(20); // radius in image pixels
  const [showHelp, setShowHelp] = useState(false);
  const [annotationCounts, setAnnotationCounts] = useState({});
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(1);
  const [images, setImages] = useState([]);

  // Hooks
  const sam = useSAM();
  const {
    annotations,
    isLoading: annotationsLoading,
    saveAnnotation,
    deleteAnnotation,
    mergeAnnotations,
    applyBrush,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useAnnotations(selectedImageId);

  // Transfer hook
  const transfer = useTransfer(selectedImageId, images, sam, annotations);

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
    setSelectedAnnotations([]);
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
    if (selectedAnnotations.length > 0) {
      selectedAnnotations.forEach((id) => deleteAnnotation(id));
      setSelectedAnnotations([]);
    }
  }, [selectedAnnotations, deleteAnnotation]);

  const handleSelectAnnotation = useCallback((id, shiftKey = false) => {
    if (id === null) {
      // Click outside - clear selection
      setSelectedAnnotations([]);
      return;
    }

    if (shiftKey) {
      // Shift+click - toggle in multi-selection
      setSelectedAnnotations((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else {
      // Normal click - single selection
      setSelectedAnnotations((prev) =>
        prev.length === 1 && prev[0] === id ? [] : [id]
      );
    }
  }, []);

  const handleMerge = useCallback(async () => {
    if (selectedAnnotations.length < 2) return;

    const classInfo = DEFAULT_CLASSES.find((c) => c.id === selectedClass);

    try {
      await mergeAnnotations(
        selectedAnnotations,
        selectedClass,
        classInfo?.name || `Class ${selectedClass}`
      );
      setSelectedAnnotations([]);
    } catch (err) {
      console.error('Failed to merge annotations:', err);
    }
  }, [selectedAnnotations, selectedClass, mergeAnnotations]);

  const handleBrushComplete = useCallback(async (brushPath, brushRadius, operation) => {
    if (selectedAnnotations.length !== 1 || brushPath.length === 0) return;

    try {
      await applyBrush(selectedAnnotations[0], brushPath, brushRadius, operation);
    } catch (err) {
      console.error('Failed to apply brush:', err);
    }
  }, [selectedAnnotations, applyBrush]);

  const handleToggleBrush = useCallback(() => {
    if (mode !== 'select' || selectedAnnotations.length !== 1) return;
    setTool((prev) => (prev === 'brush' ? 'pointer' : 'brush'));
  }, [mode, selectedAnnotations]);

  const handleToggleBrushMode = useCallback(() => {
    setBrushMode((prev) => (prev === 'add' ? 'remove' : 'add'));
  }, []);

  const handleIncreaseBrushSize = useCallback(() => {
    setBrushSize((prev) => Math.min(prev + 5, 100));
  }, []);

  const handleDecreaseBrushSize = useCallback(() => {
    setBrushSize((prev) => Math.max(prev - 5, 5));
  }, []);

  const handleToggleMode = useCallback(() => {
    setMode((prev) => {
      const newMode = prev === 'segment' ? 'select' : 'segment';
      // Clear state when switching modes
      if (newMode === 'segment') {
        setSelectedAnnotations([]);
        setTool('pointer'); // Reset brush tool
      } else {
        setPoints([]);
        sam.clearPreview();
      }
      return newMode;
    });
  }, [sam]);

  const handleSelectImage = useCallback((imageId) => {
    setSelectedImageId(imageId);
    sam.resetEncoder();
  }, [sam]);

  // Handle images loaded from ImageList
  const handleImagesLoaded = useCallback((loadedImages) => {
    setImages(loadedImages);
  }, []);

  // Save all confirmed transfers
  const handleSaveAllTransfers = useCallback(async () => {
    if (transfer.confirmedPreviews.length === 0) return;

    try {
      for (const preview of transfer.confirmedPreviews) {
        await saveAnnotation(
          preview.polygon,
          preview.bbox,
          preview.area,
          preview.classId,
          preview.className
        );
      }
      transfer.cancelTransfer();
    } catch (err) {
      console.error('Failed to save transfers:', err);
    }
  }, [transfer.confirmedPreviews, saveAnnotation, transfer.cancelTransfer]);

  // Keyboard shortcuts
  useKeyboard({
    onSave: transfer.isActive ? transfer.confirmCurrent : handleSave,
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
    onMerge: handleMerge,
    onToggleMode: handleToggleMode,
    onToggleBrush: handleToggleBrush,
    onToggleBrushMode: handleToggleBrushMode,
    onIncreaseBrushSize: handleIncreaseBrushSize,
    onDecreaseBrushSize: handleDecreaseBrushSize,
    onStartTransfer: transfer.startTransfer,
    onSkipTransfer: transfer.skipCurrent,
    onCancelTransfer: transfer.cancelTransfer,
    isTransferActive: transfer.isActive,
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
            onImagesLoaded={handleImagesLoaded}
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
            selectedAnnotations={selectedAnnotations}
            onSelectAnnotation={handleSelectAnnotation}
            showAnnotations={showAnnotations}
            currentClassId={selectedClass}
            brightness={brightness}
            contrast={contrast}
            mode={mode}
            tool={tool}
            brushMode={brushMode}
            brushSize={brushSize}
            onBrushComplete={handleBrushComplete}
            transferPoints={transfer.transferPoints}
            sourceAnnotation={transfer.currentAnnotation}
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
            mode={mode}
            onToggleMode={handleToggleMode}
            selectedCount={selectedAnnotations.length}
            tool={tool}
            brushMode={brushMode}
            brushSize={brushSize}
            onToggleBrush={handleToggleBrush}
            onToggleBrushMode={handleToggleBrushMode}
            canStartTransfer={transfer.canStartTransfer}
            onStartTransfer={transfer.startTransfer}
            isTransferActive={transfer.isActive}
          />
        </section>

        <aside className="sidebar sidebar-right">
          {transfer.isActive && (
            <TransferPanel
              isActive={transfer.isActive}
              isLoading={transfer.isLoading}
              error={transfer.error}
              sourceAnnotations={transfer.sourceAnnotations}
              currentIndex={transfer.currentIndex}
              currentAnnotation={transfer.currentAnnotation}
              confirmedPreviews={transfer.confirmedPreviews}
              settings={transfer.settings}
              onSettingsChange={transfer.updateSettings}
              onConfirm={transfer.confirmCurrent}
              onSkip={transfer.skipCurrent}
              onPrev={transfer.prevAnnotation}
              onSaveAll={handleSaveAllTransfers}
              onCancel={transfer.cancelTransfer}
              onRemoveConfirmed={transfer.removeConfirmed}
              hasPreview={!!sam.preview}
              allProcessed={transfer.allProcessed}
            />
          )}
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
            selectedIds={selectedAnnotations}
            onSelect={handleSelectAnnotation}
            onDelete={deleteAnnotation}
            onMerge={handleMerge}
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
