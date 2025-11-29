import { KEYBOARD_SHORTCUTS } from '../hooks/useKeyboard';

export function KeyboardHelp({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="keyboard-help-overlay" onClick={onClose}>
      <div className="keyboard-help" onClick={(e) => e.stopPropagation()}>
        <div className="keyboard-help-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="close-button" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="keyboard-help-content">
          {KEYBOARD_SHORTCUTS.map((category) => (
            <div key={category.category} className="shortcut-category">
              <h3>{category.category}</h3>
              <div className="shortcut-list">
                {category.shortcuts.map((shortcut) => (
                  <div key={shortcut.key} className="shortcut-item">
                    <kbd>{shortcut.key}</kbd>
                    <span>{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="keyboard-help-footer">
          <span>Press <kbd>H</kbd> or <kbd>?</kbd> to toggle this help</span>
        </div>
      </div>
    </div>
  );
}
