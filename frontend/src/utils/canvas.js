/**
 * Draw a polygon on a canvas context
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[]} polygon - Flat array [x1, y1, x2, y2, ...]
 * @param {string} fillColor
 * @param {string} strokeColor
 * @param {number} lineWidth
 */
export function drawPolygon(ctx, polygon, fillColor, strokeColor, lineWidth = 2) {
  if (polygon.length < 6) return; // Need at least 3 points

  ctx.beginPath();
  ctx.moveTo(polygon[0], polygon[1]);

  for (let i = 2; i < polygon.length; i += 2) {
    ctx.lineTo(polygon[i], polygon[i + 1]);
  }

  ctx.closePath();

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * Draw a point marker on canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {boolean} isPositive
 * @param {number} radius
 */
export function drawPoint(ctx, x, y, isPositive, radius = 6) {
  const color = isPositive ? '#22c55e' : '#ef4444';

  // Outer ring
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Inner dot
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Glow effect
  ctx.beginPath();
  ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Convert screen coordinates to image coordinates
 * @param {number} screenX
 * @param {number} screenY
 * @param {DOMRect} canvasRect
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @param {number} scale
 * @param {number} offsetX
 * @param {number} offsetY
 */
export function screenToImage(
  screenX,
  screenY,
  canvasRect,
  imageWidth,
  imageHeight,
  scale,
  offsetX,
  offsetY
) {
  const canvasX = screenX - canvasRect.left;
  const canvasY = screenY - canvasRect.top;

  const imageX = (canvasX - offsetX) / scale;
  const imageY = (canvasY - offsetY) / scale;

  return { x: imageX, y: imageY };
}

/**
 * Get class color by ID
 * @param {number} classId
 * @returns {string}
 */
export function getClassColor(classId) {
  const colors = [
    '#ef4444', // 1: Transfusion tracheid - Red
    '#3b82f6', // 2: Transfusion parenchyma cell - Blue
    '#22c55e', // 3: Endodermis cell - Green
    '#eab308', // 4: Artefact - Yellow
    '#6b7280', // 5: Other - Grey
  ];
  return colors[(classId - 1) % colors.length];
}

/**
 * Get class color with transparency
 * @param {number} classId
 * @param {number} alpha
 * @returns {string}
 */
export function getClassColorWithAlpha(classId, alpha = 0.3) {
  const color = getClassColor(classId);
  // Convert hex to rgba
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Draw a brush stroke preview on canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x: number, y: number}>} path - Array of points
 * @param {number} radius - Brush radius
 * @param {boolean} isAddMode - true for add (green), false for remove (red)
 */
export function drawBrushStroke(ctx, path, radius, isAddMode) {
  if (path.length === 0) return;

  const color = isAddMode ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)';
  const strokeColor = isAddMode ? '#22c55e' : '#ef4444';

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = radius * 2;
  ctx.strokeStyle = color;

  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);

  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();

  // Draw outline
  ctx.lineWidth = 2;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw brush cursor circle
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {boolean} isAddMode
 */
export function drawBrushCursor(ctx, x, y, radius, isAddMode) {
  const color = isAddMode ? '#22c55e' : '#ef4444';

  ctx.save();

  // Draw filled circle with transparency
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = isAddMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';
  ctx.fill();

  // Draw outline
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw crosshair
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x + 4, y);
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y + 4);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}
