# Cell Labeler

Web-based UI for labelling cells in microscopy images using SAM2.1 (Segment Anything Model). Designed for creating training data for downstream segmentation models.

## Features

- **Click-to-segment**: Left-click for positive points, right-click for negative points
- **Multi-point prompting**: Refine segmentation with multiple clicks before saving
- **Keyboard-driven workflow**: Extensive shortcuts for efficient labelling
- **Multi-class support**: Define cell types with color-coded masks
- **Undo/Redo**: Full annotation history
- **Low-contrast optimization**: CLAHE enhancement for microscopy images
- **CPU/GPU support**: Automatic device detection with CPU fallback

## Quick Start

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000 (docs at http://localhost:8000/docs).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The UI will be available at http://localhost:5173.

### Testing without GPU

```bash
USE_MOCK_SAM=true uv run uvicorn app.main:app --reload
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Left Click` | Add positive point |
| `Right Click` | Add negative point |
| `Enter` | Save segmentation |
| `Backspace` | Remove last point |
| `Esc` | Clear all points |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `N` / `→` | Next image |
| `P` / `←` | Previous image |
| `1-9` | Select class |
| `V` | Toggle annotations |
| `H` / `?` | Show help |

## Architecture

- **Backend**: FastAPI (Python) - REST API for image serving, SAM inference, and annotation management
- **Frontend**: React + Vite (JavaScript) - Interactive canvas for click-to-segment labelling
- **Model**: SAM2.1 (sam2.1-hiera-small) with CLAHE contrast enhancement

## Development

### Linting & Type Checking

```bash
cd backend
uv run ruff check .          # Lint
uv run ruff check --fix .    # Auto-fix
uv run basedpyright          # Type check
```

### Running Tests

```bash
cd backend
uv run pytest                # All tests
uv run pytest -k "test_name" # By pattern
```

### Pre-commit Hooks

```bash
pre-commit install           # Set up (once)
pre-commit run --all-files   # Run manually
```

## Data

Place your image data in `data/raw/`. The backend expects a ZIP file with image slices that will be extracted automatically.
