import { getClassColor } from '../utils/canvas';

/**
 * Panel for managing label transfer from previous slice.
 * Shows settings sliders, progress, and action buttons.
 */
export function TransferPanel({
  isActive,
  isLoading,
  error,
  sourceAnnotations,
  currentIndex,
  currentAnnotation,
  confirmedPreviews,
  settings,
  onSettingsChange,
  onConfirm,
  onSkip,
  onPrev,
  onSaveAll,
  onCancel,
  onRemoveConfirmed,
  hasPreview,
  allProcessed,
}) {
  if (!isActive) return null;

  const progress = sourceAnnotations.length > 0
    ? `${currentIndex + 1} / ${sourceAnnotations.length}`
    : '0 / 0';

  return (
    <div className="transfer-panel">
      <div className="transfer-header">
        <h3>Transfer Labels</h3>
        <span className="transfer-progress">{progress}</span>
      </div>

      {error && (
        <div className="transfer-error">
          {error}
        </div>
      )}

      {/* Settings sliders */}
      <div className="transfer-settings">
        <div className="adjustment-control">
          <div className="adjustment-label">
            <span>Positive points</span>
            <span className="adjustment-value">{settings.positivePoints}</span>
          </div>
          <input
            type="range"
            min="1"
            max="3"
            value={settings.positivePoints}
            onChange={(e) => onSettingsChange({ positivePoints: Number(e.target.value) })}
            className="adjustment-slider"
          />
        </div>

        <div className="adjustment-control">
          <div className="adjustment-label">
            <span>Negative points</span>
            <span className="adjustment-value">{settings.negativePoints}</span>
          </div>
          <input
            type="range"
            min="0"
            max="3"
            value={settings.negativePoints}
            onChange={(e) => onSettingsChange({ negativePoints: Number(e.target.value) })}
            className="adjustment-slider"
          />
        </div>
      </div>

      {/* Current annotation info */}
      {currentAnnotation && !allProcessed && (
        <div className="transfer-current">
          <div className="transfer-current-label">Transferring:</div>
          <div
            className="transfer-class-badge"
            style={{ '--class-color': getClassColor(currentAnnotation.class_id) }}
          >
            <div className="class-indicator" />
            <span>{currentAnnotation.class_name}</span>
          </div>
        </div>
      )}

      {/* Navigation and action buttons */}
      {!allProcessed && (
        <div className="transfer-actions">
          <button
            className="transfer-button secondary"
            onClick={onPrev}
            disabled={currentIndex === 0 || isLoading}
            title="Previous annotation"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            className="transfer-button secondary"
            onClick={onSkip}
            disabled={isLoading}
            title="Skip this annotation (Tab)"
          >
            Skip
          </button>

          <button
            className="transfer-button primary"
            onClick={onConfirm}
            disabled={!hasPreview || isLoading}
            title="Confirm transfer (Enter)"
          >
            {isLoading ? 'Loading...' : 'Confirm'}
          </button>
        </div>
      )}

      {/* Confirmed previews list */}
      {confirmedPreviews.length > 0 && (
        <div className="transfer-confirmed">
          <div className="transfer-confirmed-header">
            Confirmed ({confirmedPreviews.length})
          </div>
          <div className="transfer-confirmed-list">
            {confirmedPreviews.map((preview, idx) => (
              <div
                key={idx}
                className="transfer-confirmed-item"
                style={{ '--class-color': getClassColor(preview.classId) }}
              >
                <div className="class-indicator" />
                <span className="confirmed-class-name">{preview.className}</span>
                <button
                  className="confirmed-remove"
                  onClick={() => onRemoveConfirmed(idx)}
                  title="Remove"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="transfer-bottom-actions">
        <button
          className="transfer-button cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="transfer-button save"
          onClick={onSaveAll}
          disabled={confirmedPreviews.length === 0}
          title={`Save all confirmed transfers (${confirmedPreviews.length})`}
        >
          Save All ({confirmedPreviews.length})
        </button>
      </div>
    </div>
  );
}
