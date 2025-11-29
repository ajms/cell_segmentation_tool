import { getClassColor } from '../utils/canvas';

export function AnnotationList({
  annotations,
  selectedId,
  onSelect,
  onDelete,
  visible,
  onToggleVisibility,
}) {
  return (
    <div className="annotation-list">
      <div className="annotation-list-header">
        <h3>Annotations</h3>
        <div className="annotation-controls">
          <span className="annotation-count">{annotations.length}</span>
          <button
            className={`visibility-toggle ${visible ? 'visible' : 'hidden'}`}
            onClick={onToggleVisibility}
            title={visible ? 'Hide annotations (V)' : 'Show annotations (V)'}
          >
            {visible ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="annotation-items">
        {annotations.length === 0 ? (
          <div className="annotation-empty">
            <p>No annotations yet</p>
            <span>Click on the image to start segmenting</span>
          </div>
        ) : (
          annotations.map((ann) => {
            const isSelected = ann.id === selectedId;
            const color = getClassColor(ann.class_id);

            return (
              <div
                key={ann.id}
                className={`annotation-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelect(isSelected ? null : ann.id)}
              >
                <div
                  className="annotation-color"
                  style={{ backgroundColor: color }}
                />
                <div className="annotation-info">
                  <span className="annotation-class">{ann.class_name}</span>
                  <span className="annotation-area">
                    {Math.round(ann.area).toLocaleString()} px
                  </span>
                </div>
                <button
                  className="annotation-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(ann.id);
                  }}
                  title="Delete annotation"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
