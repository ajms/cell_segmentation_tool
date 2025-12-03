import { useEffect, useCallback } from 'react';

export function useKeyboard({
  onSave,
  onClear,
  onUndo,
  onRedo,
  onNextImage,
  onPrevImage,
  onSelectClass,
  onToggleHelp,
  onToggleAnnotations,
  onDeleteSelected,
  onRemoveLastPoint,
  onMerge,
  onToggleMode,
  onToggleBrush,
  onToggleBrushMode,
  onIncreaseBrushSize,
  onDecreaseBrushSize,
  // Transfer mode callbacks
  onStartTransfer,
  onSkipTransfer,
  onCancelTransfer,
  isTransferActive = false,
  enabled = true,
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (!enabled) return;

      // Ignore if typing in an input
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      // Transfer mode: Cancel on Escape
      if (e.key === 'Escape' && isTransferActive) {
        e.preventDefault();
        onCancelTransfer?.();
        return;
      }

      // Transfer mode: Skip on Tab
      if (e.key === 'Tab' && isTransferActive) {
        e.preventDefault();
        onSkipTransfer?.();
        return;
      }

      // Save: Enter (also confirms transfer in transfer mode)
      if (e.key === 'Enter' && !isCtrl) {
        e.preventDefault();
        onSave?.();
        return;
      }

      // Clear: Escape (when not in transfer mode)
      if (e.key === 'Escape' && !isTransferActive) {
        e.preventDefault();
        onClear?.();
        return;
      }

      // Remove last point: Backspace
      if (e.key === 'Backspace' && !isCtrl) {
        e.preventDefault();
        onRemoveLastPoint?.();
        return;
      }

      // Undo: Ctrl+Z
      if (isCtrl && key === 'z' && !isShift) {
        e.preventDefault();
        onUndo?.();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((isCtrl && key === 'y') || (isCtrl && isShift && key === 'z')) {
        e.preventDefault();
        onRedo?.();
        return;
      }

      // Next image: N or ArrowRight
      if (key === 'n' || e.key === 'ArrowRight') {
        e.preventDefault();
        onNextImage?.();
        return;
      }

      // Previous image: P or ArrowLeft
      if (key === 'p' || e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrevImage?.();
        return;
      }

      // Toggle help: H or ?
      if (key === 'h' || key === '?') {
        e.preventDefault();
        onToggleHelp?.();
        return;
      }

      // Toggle annotations visibility: V
      if (key === 'v' && !isCtrl) {
        e.preventDefault();
        onToggleAnnotations?.();
        return;
      }

      // Delete selected: Delete
      if (e.key === 'Delete') {
        e.preventDefault();
        onDeleteSelected?.();
        return;
      }

      // Merge selected: M
      if (key === 'm' && !isCtrl) {
        e.preventDefault();
        onMerge?.();
        return;
      }

      // Toggle mode: S
      if (key === 's' && !isCtrl) {
        e.preventDefault();
        onToggleMode?.();
        return;
      }

      // Toggle brush tool: B
      if (key === 'b' && !isCtrl) {
        e.preventDefault();
        onToggleBrush?.();
        return;
      }

      // Toggle brush add/remove mode: X
      if (key === 'x' && !isCtrl) {
        e.preventDefault();
        onToggleBrushMode?.();
        return;
      }

      // Start transfer: T
      if (key === 't' && !isCtrl && !isTransferActive) {
        e.preventDefault();
        onStartTransfer?.();
        return;
      }

      // Decrease brush size: [
      if (e.key === '[' && !isCtrl) {
        e.preventDefault();
        onDecreaseBrushSize?.();
        return;
      }

      // Increase brush size: ]
      if (e.key === ']' && !isCtrl) {
        e.preventDefault();
        onIncreaseBrushSize?.();
        return;
      }

      // Class selection: 1-9
      if (/^[1-9]$/.test(key) && !isCtrl && !isShift) {
        e.preventDefault();
        onSelectClass?.(parseInt(key, 10));
        return;
      }
    },
    [
      enabled,
      onSave,
      onClear,
      onUndo,
      onRedo,
      onNextImage,
      onPrevImage,
      onSelectClass,
      onToggleHelp,
      onToggleAnnotations,
      onDeleteSelected,
      onRemoveLastPoint,
      onMerge,
      onToggleMode,
      onToggleBrush,
      onToggleBrushMode,
      onIncreaseBrushSize,
      onDecreaseBrushSize,
      onStartTransfer,
      onSkipTransfer,
      onCancelTransfer,
      isTransferActive,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export const KEYBOARD_SHORTCUTS = [
  { category: 'Segmentation', shortcuts: [
    { key: 'Left Click', description: 'Add positive point' },
    { key: 'Right Click', description: 'Add negative point' },
    { key: 'Enter', description: 'Save segmentation' },
    { key: 'Backspace', description: 'Remove last point' },
    { key: 'Esc', description: 'Clear all points' },
  ]},
  { category: 'Edit', shortcuts: [
    { key: 'Ctrl+Z', description: 'Undo' },
    { key: 'Ctrl+Y', description: 'Redo' },
    { key: 'Delete', description: 'Delete selected annotation(s)' },
    { key: 'M', description: 'Merge selected annotations' },
  ]},
  { category: 'Mode', shortcuts: [
    { key: 'S', description: 'Toggle segment/select mode' },
    { key: 'Shift+Click', description: 'Multi-select (in select mode)' },
  ]},
  { category: 'Transfer', shortcuts: [
    { key: 'T', description: 'Start label transfer from previous slice' },
    { key: 'Enter', description: 'Confirm current transfer' },
    { key: 'Tab', description: 'Skip current annotation' },
    { key: 'Esc', description: 'Cancel transfer' },
  ]},
  { category: 'Brush Tool', shortcuts: [
    { key: 'B', description: 'Toggle brush tool (select mode)' },
    { key: 'X', description: 'Toggle add/remove mode' },
    { key: '[', description: 'Decrease brush size' },
    { key: ']', description: 'Increase brush size' },
  ]},
  { category: 'Navigation', shortcuts: [
    { key: 'N / \u2192', description: 'Next image' },
    { key: 'P / \u2190', description: 'Previous image' },
  ]},
  { category: 'Classes', shortcuts: [
    { key: '1-9', description: 'Select class 1-9' },
  ]},
  { category: 'View', shortcuts: [
    { key: 'V', description: 'Toggle annotations' },
    { key: 'H / ?', description: 'Show help' },
  ]},
];
