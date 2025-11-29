import { useRef, useEffect, useState, useCallback } from 'react';
import { getImageUrl } from '../utils/api';
import {
  drawPolygon,
  drawPoint,
  screenToImage,
  getClassColor,
  getClassColorWithAlpha,
  drawBrushStroke,
  drawBrushCursor,
} from '../utils/canvas';

export function ImageCanvas({
  imageId,
  imageInfo,
  annotations,
  preview,
  points,
  onAddPoint,
  selectedAnnotations = [],
  onSelectAnnotation,
  showAnnotations = true,
  currentClassId = 1,
  brightness = 0,
  contrast = 1,
  mode = 'segment',
  tool = 'pointer',
  brushMode = 'add',
  brushSize = 20,
  onBrushComplete,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Brush state
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushPath, setBrushPath] = useState([]);
  const [mousePos, setMousePos] = useState(null);

  // Load image when ID changes
  useEffect(() => {
    if (!imageId) return;

    setImageLoaded(false);
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = getImageUrl(imageId);
  }, [imageId]);

  // Calculate scale and offset to fit image in canvas
  useEffect(() => {
    if (!imageLoaded || !containerRef.current || !imageInfo) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const scaleX = containerWidth / imageInfo.width;
    const scaleY = containerHeight / imageInfo.height;
    const newScale = Math.min(scaleX, scaleY, 1); // Don't scale up

    const offsetX = (containerWidth - imageInfo.width * newScale) / 2;
    const offsetY = (containerHeight - imageInfo.height * newScale) / 2;

    setScale(newScale);
    setOffset({ x: offsetX, y: offsetY });
  }, [imageLoaded, imageInfo]);

  // Draw everything
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay || !imageLoaded || !imageRef.current) return;

    const ctx = canvas.getContext('2d');
    const overlayCtx = overlay.getContext('2d');

    // Clear canvases
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

    // Draw image
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    ctx.drawImage(imageRef.current, 0, 0);
    ctx.restore();

    // Draw saved annotations on overlay
    if (showAnnotations) {
      overlayCtx.save();
      overlayCtx.translate(offset.x, offset.y);
      overlayCtx.scale(scale, scale);

      annotations.forEach((ann) => {
        const isSelected = selectedAnnotations.includes(ann.id);
        const color = getClassColor(ann.class_id);
        const fillAlpha = isSelected ? 0.5 : 0.3;

        ann.segmentation.forEach((polygon) => {
          drawPolygon(
            overlayCtx,
            polygon,
            getClassColorWithAlpha(ann.class_id, fillAlpha),
            isSelected ? '#ffffff' : color,
            isSelected ? 3 : 2
          );
        });
      });

      overlayCtx.restore();
    }

    // Draw preview mask
    if (preview && preview.polygon) {
      overlayCtx.save();
      overlayCtx.translate(offset.x, offset.y);
      overlayCtx.scale(scale, scale);

      const previewColor = getClassColor(currentClassId);
      preview.polygon.forEach((polygon) => {
        // Dashed outline for preview
        overlayCtx.setLineDash([8, 4]);
        drawPolygon(
          overlayCtx,
          polygon,
          getClassColorWithAlpha(currentClassId, 0.4),
          previewColor,
          2
        );
        overlayCtx.setLineDash([]);
      });

      overlayCtx.restore();
    }

    // Draw click points
    overlayCtx.save();
    overlayCtx.translate(offset.x, offset.y);
    overlayCtx.scale(scale, scale);

    points.forEach((point) => {
      drawPoint(overlayCtx, point.x, point.y, point.is_positive, 6 / scale);
    });

    overlayCtx.restore();

    // Draw brush stroke preview and cursor
    if (mode === 'select' && tool === 'brush' && selectedAnnotations.length === 1) {
      overlayCtx.save();
      overlayCtx.translate(offset.x, offset.y);
      overlayCtx.scale(scale, scale);

      // Draw current brush stroke
      if (brushPath.length > 0) {
        drawBrushStroke(overlayCtx, brushPath, brushSize, brushMode === 'add');
      }

      // Draw brush cursor at mouse position
      if (mousePos) {
        drawBrushCursor(overlayCtx, mousePos.x, mousePos.y, brushSize, brushMode === 'add');
      }

      overlayCtx.restore();
    }
  }, [
    imageLoaded,
    scale,
    offset,
    annotations,
    preview,
    points,
    selectedAnnotations,
    showAnnotations,
    currentClassId,
    mode,
    tool,
    brushPath,
    brushSize,
    brushMode,
    mousePos,
  ]);

  // Redraw on changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const canvas = canvasRef.current;
      const overlay = overlayRef.current;

      if (canvas && overlay) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        overlay.width = container.clientWidth;
        overlay.height = container.clientHeight;
        draw();
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  // Helper to get image coordinates from mouse event
  const getImageCoords = useCallback((e) => {
    if (!imageInfo || !canvasRef.current) return null;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const { x, y } = screenToImage(
      e.clientX,
      e.clientY,
      rect,
      imageInfo.width,
      imageInfo.height,
      scale,
      offset.x,
      offset.y
    );

    // Check if within image bounds
    if (x < 0 || x >= imageInfo.width || y < 0 || y >= imageInfo.height) {
      return null;
    }

    return { x, y };
  }, [imageInfo, scale, offset]);

  // Brush mode: check if brush is active
  const isBrushActive = mode === 'select' && tool === 'brush' && selectedAnnotations.length === 1;

  // Handle mouse down
  const handleMouseDown = (e) => {
    const coords = getImageCoords(e);
    if (!coords) return;

    if (isBrushActive) {
      // Start brush stroke
      setIsDrawing(true);
      setBrushPath([coords]);
    } else if (mode === 'segment') {
      // Segment mode: add points for SAM
      const isPositive = e.button !== 2;
      onAddPoint?.({ x: coords.x, y: coords.y, is_positive: isPositive });
    } else if (mode === 'select' && tool === 'pointer') {
      // Select mode with pointer tool: select annotations
      if (!showAnnotations) return;

      for (const ann of annotations) {
        for (const polygon of ann.segmentation) {
          if (isPointInPolygon(coords.x, coords.y, polygon)) {
            onSelectAnnotation?.(ann.id, e.shiftKey);
            return;
          }
        }
      }
      // Click not on annotation - deselect
      onSelectAnnotation?.(null, e.shiftKey);
    }
  };

  // Handle mouse move
  const handleMouseMove = (e) => {
    const coords = getImageCoords(e);

    if (isBrushActive) {
      // Update mouse position for cursor
      setMousePos(coords);

      // If drawing, add to brush path
      if (isDrawing && coords) {
        setBrushPath((prev) => [...prev, coords]);
      }
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    if (isDrawing && brushPath.length > 0) {
      // Complete brush stroke
      onBrushComplete?.(brushPath, brushSize, brushMode);
      setBrushPath([]);
    }
    setIsDrawing(false);
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setMousePos(null);
    if (isDrawing) {
      // Complete brush stroke when leaving canvas
      if (brushPath.length > 0) {
        onBrushComplete?.(brushPath, brushSize, brushMode);
      }
      setBrushPath([]);
      setIsDrawing(false);
    }
  };

  // Prevent context menu, use for negative points in segment mode
  const handleContextMenu = (e) => {
    e.preventDefault();
    if (mode === 'segment') {
      const coords = getImageCoords(e);
      if (coords) {
        onAddPoint?.({ x: coords.x, y: coords.y, is_positive: false });
      }
    }
  };

  if (!imageId) {
    return (
      <div className="canvas-container canvas-empty">
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
          <p>Select an image to begin labelling</p>
        </div>
      </div>
    );
  }

  // Compute CSS filter for brightness/contrast adjustments
  const imageFilter = `brightness(${1 + brightness / 100}) contrast(${contrast})`;

  // Determine canvas class based on mode and tool
  const canvasClass = [
    'canvas-overlay',
    mode === 'select' ? 'select-mode' : 'segment-mode',
    isBrushActive ? 'brush-mode' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="canvas-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="canvas-base"
        style={{ filter: imageFilter }}
      />
      <canvas
        ref={overlayRef}
        className={canvasClass}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
      />
      {!imageLoaded && (
        <div className="canvas-loading">
          <div className="loading-spinner" />
          <span>Loading image...</span>
        </div>
      )}
    </div>
  );
}

// Point-in-polygon test
function isPointInPolygon(x, y, polygon) {
  let inside = false;
  const n = polygon.length / 2;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i * 2];
    const yi = polygon[i * 2 + 1];
    const xj = polygon[j * 2];
    const yj = polygon[j * 2 + 1];

    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}
