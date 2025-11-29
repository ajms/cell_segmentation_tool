import { getClassColor } from '../utils/canvas';

const DEFAULT_CLASSES = [
  { id: 1, name: 'Transfusion tracheid' },
  { id: 2, name: 'Transfusion parenchyma cell' },
  { id: 3, name: 'Endodermis cell' },
  { id: 4, name: 'Artefact' },
  { id: 5, name: 'Other' },
];

export function ClassSelector({
  selectedClass,
  onSelectClass,
  classes = DEFAULT_CLASSES,
}) {
  return (
    <div className="class-selector">
      <div className="class-selector-header">
        <h3>Classes</h3>
        <span className="shortcut-hint">Press 1-9</span>
      </div>

      <div className="class-list">
        {classes.map((cls) => {
          const isSelected = cls.id === selectedClass;
          const color = getClassColor(cls.id);

          return (
            <button
              key={cls.id}
              className={`class-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectClass(cls.id)}
              style={{
                '--class-color': color,
              }}
            >
              <div className="class-indicator" />
              <span className="class-name">{cls.name}</span>
              <span className="class-shortcut">{cls.id}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { DEFAULT_CLASSES };
