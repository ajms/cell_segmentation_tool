export function ImageAdjustments({ brightness, contrast, onBrightnessChange, onContrastChange, onReset }) {
  return (
    <div className="image-adjustments">
      <div className="adjustments-header">
        <h3>Image Adjustments</h3>
        <button
          className="reset-button"
          onClick={onReset}
          title="Reset to defaults"
        >
          Reset
        </button>
      </div>

      <div className="adjustment-control">
        <div className="adjustment-label">
          <span>Brightness</span>
          <span className="adjustment-value">{brightness > 0 ? '+' : ''}{brightness}</span>
        </div>
        <input
          type="range"
          min="-100"
          max="100"
          value={brightness}
          onChange={(e) => onBrightnessChange(Number(e.target.value))}
          className="adjustment-slider"
        />
      </div>

      <div className="adjustment-control">
        <div className="adjustment-label">
          <span>Contrast</span>
          <span className="adjustment-value">{contrast.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="50"
          max="200"
          value={contrast * 100}
          onChange={(e) => onContrastChange(Number(e.target.value) / 100)}
          className="adjustment-slider"
        />
      </div>
    </div>
  );
}
