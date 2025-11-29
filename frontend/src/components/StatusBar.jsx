export function StatusBar({
  isEncoding,
  isSegmenting,
  pointCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onSave,
  mode = 'segment',
  onToggleMode,
  selectedCount = 0,
}) {
  return (
    <div className="status-bar">
      <div className="status-left">
        <button
          className={`mode-toggle ${mode}`}
          onClick={onToggleMode}
          title="Toggle mode (S)"
        >
          {mode === 'segment' ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4m0 12v4m10-10h-4M6 12H2" />
              </svg>
              <span>Segment</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              </svg>
              <span>Select</span>
            </>
          )}
        </button>

        <div className="status-divider" />

        {mode === 'segment' && (
          <>
            {isEncoding && (
              <div className="status-indicator encoding">
                <div className="status-dot pulse" />
                <span>Encoding...</span>
              </div>
            )}
            {isSegmenting && (
              <div className="status-indicator segmenting">
                <div className="status-dot pulse" />
                <span>Segmenting...</span>
              </div>
            )}
            {!isEncoding && !isSegmenting && pointCount > 0 && (
              <div className="status-indicator points">
                <span>{pointCount} point{pointCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </>
        )}
        {mode === 'select' && selectedCount > 0 && (
          <div className="status-indicator selected">
            <span>{selectedCount} selected</span>
          </div>
        )}
      </div>

      <div className="status-actions">
        <button
          className="status-button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
          </svg>
        </button>
        <button
          className="status-button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7" />
          </svg>
        </button>

        <div className="status-divider" />

        <button
          className="status-button"
          onClick={onClear}
          disabled={pointCount === 0}
          title="Clear points (Esc)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </button>
        <button
          className="status-button primary"
          onClick={onSave}
          disabled={pointCount === 0}
          title="Save segmentation (Enter)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Save</span>
        </button>
      </div>
    </div>
  );
}
