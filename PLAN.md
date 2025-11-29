# Cell Labelling Web UI - Implementation Plan

## Overview
Build a web-based UI for labelling cells in microscopy images using SAM2.1 (Segment Anything Model). This is a 2-stage approach where labeled data from this tool will be used to train a proper segmentation model later.

## Implementation Status

### Phase 1: Backend Setup - COMPLETED
- [x] Environment & Dependencies (uv, pyproject.toml, pre-commit)
- [x] FastAPI app with CORS middleware
- [x] Image Management API (`GET /api/images`, `GET /api/images/{id}`, `GET /api/images/{id}/info`)
- [x] SAM2.1 Integration (`POST /api/sam/encode/{id}`, `POST /api/sam/segment`)
- [x] Annotation Management (`GET/POST/PUT/DELETE /api/annotations`)
- [x] 27 passing tests with TDD approach
- [x] Mock SAM model for testing on weak machines (USE_MOCK_SAM=true)
- [x] CPU fallback when CUDA not available
- [x] CLAHE contrast enhancement for low-contrast microscopy images
- [x] Morphological mask refinement for cleaner boundaries
- [x] Upgraded to sam2.1-hiera-small model for better accuracy

### Phase 2: Frontend Setup - COMPLETED
- [x] React + Vite scaffold with Axios
- [x] API client utility (`src/utils/api.js`)
- [x] Canvas utilities (`src/utils/canvas.js`)
- [x] Custom hooks: `useSAM`, `useAnnotations`, `useKeyboard`
- [x] Components: `ImageCanvas`, `ImageList`, `ClassSelector`, `AnnotationList`, `KeyboardHelp`, `StatusBar`
- [x] Dark scientific/laboratory aesthetic with grid background
- [x] Vite proxy configured for `/api` to backend

### Phase 3: Interactive Labelling - IN PROGRESS
- [x] Click-to-segment workflow (left click = positive, right click = negative)
- [x] Multi-point prompting with preview mask
- [x] Keyboard shortcuts for all actions
- [ ] Next/Previous image navigation (partially implemented)
- [x] **Prevent label overlaps** - Exclude existing annotations from new segmentations
- [x] **Merge annotations** - Select multiple annotations and merge into one using polygon union
- [x] **Segment/Select modes** - Separate modes for SAM segmentation vs annotation selection
- [x] **Brush tool** - Paint to fill holes (add) or trim edges (remove) on annotations

### Phase 4: Polish & Export - NOT STARTED

---

## Completed: Prevent Label Overlaps (DONE)

### Summary
Implemented feature to ensure new segmentation masks don't overlap with existing labels. When creating a new annotation, any pixels already belonging to existing annotations are automatically excluded.

### Implementation
- **Backend** (`backend/app/api/sam.py`): Added `existing_polygons` field to `SegmentRequest` and `polygons_to_mask()` helper function. After SAM prediction, the exclusion mask is subtracted from the result.
- **Tests** (`backend/tests/test_sam_api.py`): Added tests verifying overlap exclusion works correctly.
- **Frontend** (`frontend/src/utils/api.js`, `frontend/src/hooks/useSAM.js`, `frontend/src/App.jsx`): Updated to pass existing annotation polygons when calling segment.

---

## Completed: Merge Annotations (DONE)

### Summary
Implemented feature to merge multiple selected annotations into a single annotation using geometric polygon union (Shapely).

### Usage
1. **Select annotations**: Click an annotation to select it. Hold Shift and click additional annotations to multi-select.
2. **Merge**: Press `M` key or click the "Merge" button that appears when 2+ annotations are selected.
3. **Result**: Selected annotations are combined into one using polygon union. The merged annotation uses the currently selected class.

### Implementation
- **Backend** (`backend/app/api/annotations.py`): Added `POST /api/annotations/merge` endpoint. Uses Shapely to compute `unary_union` of all polygons.
- **Backend** (`backend/app/utils/annotation_store.py`): Added `merge_annotations()` method with polygon-to-geometry conversion.
- **Tests** (`backend/tests/test_annotations_api.py`): Added 5 tests for merge functionality (TDD approach).
- **Frontend**: Multi-selection state (`selectedAnnotations` array), Shift+click handling, M keyboard shortcut, merge button UI.
- **Dependency**: Added `shapely>=2.0.0` to `pyproject.toml`.

---

## Completed: Segment/Select Modes (DONE)

### Summary
Separated click behavior into two distinct modes to avoid confusion between adding SAM segmentation points and selecting existing annotations.

### Usage
- **Segment mode** (default): Click adds positive SAM points, right-click adds negative points
- **Select mode**: Click to select annotations, Shift+click for multi-select
- Press `S` to toggle between modes (or click mode button in status bar)
- Mode indicator in status bar shows current mode with distinct colors

### Implementation
- **Frontend** (`frontend/src/App.jsx`): Added `mode` state and `handleToggleMode` callback
- **Frontend** (`frontend/src/components/ImageCanvas.jsx`): Click handler uses mode to determine behavior
- **Frontend** (`frontend/src/components/StatusBar.jsx`): Mode toggle button with visual indicator
- **Frontend** (`frontend/src/hooks/useKeyboard.js`): Added `S` key shortcut for mode toggle

---

## Completed: Brush Tool (DONE)

### Summary
Added a brush tool to modify existing annotations by painting to fill holes (add mode) or trim edges (remove mode). Uses Shapely for polygon union/difference operations on the backend.

### Usage
1. Switch to **Select mode** (`S` key) and select a single annotation
2. Press `B` to activate the brush tool
3. Press `X` to toggle between add (green) and remove (red) modes
4. Use `[` and `]` to decrease/increase brush size
5. Paint on the canvas - changes are applied on mouse release
6. Supports undo/redo (`Ctrl+Z` / `Ctrl+Y`)

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `B` | Toggle brush tool (select mode, 1 annotation selected) |
| `X` | Toggle add/remove mode |
| `[` | Decrease brush size |
| `]` | Increase brush size |

### Implementation
- **Backend** (`backend/app/api/annotations.py`): Added `PATCH /api/annotations/{id}/brush` endpoint
- **Backend** (`backend/app/utils/annotation_store.py`): Added `apply_brush_to_annotation()` method using Shapely `unary_union` (add) and `difference` (remove) operations
- **Frontend** (`frontend/src/utils/api.js`): Added `applyBrushToAnnotation()` API function
- **Frontend** (`frontend/src/hooks/useAnnotations.js`): Added `applyBrush()` method with undo/redo support
- **Frontend** (`frontend/src/components/ImageCanvas.jsx`): Brush drawing, mouse events, cursor rendering
- **Frontend** (`frontend/src/utils/canvas.js`): Added `drawBrushStroke()` and `drawBrushCursor()` utilities
- **Frontend** (`frontend/src/components/StatusBar.jsx`): Brush tool toggle, mode indicator, size display
- **Tests** (`backend/tests/test_annotations_api.py`): 7 new tests for brush add/remove operations

---

## Architecture
- **Backend**: FastAPI (Python)
- **Frontend**: React (JavaScript)
- **Model**: SAM2.1 (Segment Anything Model 2.1)
- **Data**: 3D cell images from `rec_8bit_Paganin.zip`, treated as independent 2D slices

## Project Structure
```
cell_detection_v2/
├── .pre-commit-config.yaml       # Pre-commit hooks config
├── backend/
│   ├── pyproject.toml            # uv project config (deps, ruff, basedpyright)
│   ├── tests/                    # pytest tests (TDD)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI application entry point
│   │   ├── config.py            # Configuration settings
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── sam_model.py     # SAM2.1 wrapper and inference
│   │   │   └── schemas.py       # Pydantic models for API
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── images.py        # Image listing and serving endpoints
│   │   │   ├── annotations.py   # Annotation CRUD endpoints
│   │   │   └── sam.py           # SAM inference endpoints
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── image_loader.py  # Image extraction and loading
│   │       └── coco_export.py   # COCO format export utilities
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── components/
│       │   ├── ImageCanvas.jsx      # Main canvas with SAM interaction
│       │   ├── ImageList.jsx        # Image navigation sidebar
│       │   ├── AnnotationPanel.jsx  # Label classes and controls
│       │   ├── ClassSelector.jsx    # Multi-class label selector
│       │   ├── AnnotationList.jsx   # List of saved annotations
│       │   └── KeyboardHelp.jsx     # Keyboard shortcut overlay
│       ├── hooks/
│       │   ├── useAnnotations.js    # Annotation state management
│       │   ├── useKeyboard.js       # Keyboard shortcuts handler
│       │   └── useSAM.js            # SAM API integration
│       ├── utils/
│       │   ├── api.js               # API client
│       │   └── canvas.js            # Canvas utilities
│       └── styles/
│           └── App.css
├── data/
│   ├── raw/
│   │   ├── Screenshot 2025-11-23 143138.png
│   │   └── rec_8bit_Paganin.zip
│   ├── images/                      # Extracted image slices
│   └── annotations/                 # Saved annotations (JSON)
├── README.md
└── PLAN.md (this file)
```

---

## Phase 1: Backend Setup (FastAPI)

### 1.1 Environment & Dependencies
- Use `uv` for Python package management
- Install dependencies via `pyproject.toml`:
  - FastAPI for REST API
  - Uvicorn for ASGI server
  - SAM2.1 (Segment Anything Model)
  - OpenCV, NumPy, Pillow for image processing
  - Pydantic for data validation
- Dev dependencies:
  - `pytest` for testing (TDD workflow)
  - `ruff` for linting and formatting
  - `basedpyright` for type checking
  - `pre-commit` for git hooks
- **TDD approach**: Write tests first, then implement code to pass them
- Configure CORS middleware for React communication

### 1.2 Image Management API
**Extract and serve images from the 3D dataset**

Endpoints:
- `GET /api/images` - List all available images with metadata
- `GET /api/images/{image_id}` - Serve specific image as JPEG/PNG
- `GET /api/images/{image_id}/info` - Get image dimensions and info

Tasks:
- Extract slices from `rec_8bit_Paganin.zip` to `data/images/`
- Handle 3D stack as individual 2D slices
- Generate unique IDs for each slice
- Cache extracted images for fast serving

### 1.3 SAM2.1 Integration
**Real-time segmentation based on user clicks**

Endpoints:
- `POST /api/sam/encode` - Encode image (returns embedding ID for caching)
- `POST /api/sam/segment` - Generate mask from click points
  - Input: image_id, positive_points, negative_points
  - Output: segmentation mask (RLE or polygon format)

Features:
- Load SAM2.1 model on server startup
- Cache image embeddings to speed up inference
- Support multiple positive/negative prompts
- Return mask as binary image or polygon coordinates

### 1.4 Annotation Management
**Save, load, and export annotations**

Endpoints:
- `GET /api/annotations/{image_id}` - Load all annotations for an image
- `POST /api/annotations/{image_id}` - Save new annotation
- `PUT /api/annotations/{annotation_id}` - Update annotation
- `DELETE /api/annotations/{annotation_id}` - Delete annotation
- `POST /api/export/coco` - Export all annotations to COCO format

Data structure:
```json
{
  "image_id": "slice_0001",
  "annotations": [
    {
      "id": "uuid",
      "class_id": 1,
      "class_name": "cell_type_1",
      "segmentation": [[x1, y1, x2, y2, ...]],
      "bbox": [x, y, width, height],
      "area": 1234,
      "created_at": "timestamp"
    }
  ]
}
```

---

## Phase 2: Frontend Setup (React + Vite)

### 2.1 React App Scaffold
- Initialize React app with Vite
- Install dependencies:
  - Axios for API calls
  - Konva or Fabric.js for canvas manipulation (optional)
  - CSS framework (Tailwind or custom)
- Configure API base URL for backend communication

### 2.2 Core Components

**ImageCanvas** (Main interaction area)
- Display current image
- Render click points (positive = green, negative = red)
- Overlay SAM preview mask (semi-transparent)
- Show saved annotations with color-coded masks
- Support zoom and pan

**ImageList** (Navigation sidebar)
- List all available images
- Show progress (labeled/total)
- Highlight current image
- Click to switch images

**ClassSelector** (Label type chooser)
- List of cell classes/categories
- Add/edit/delete classes
- Color picker for each class
- Keyboard shortcuts (1-9) for quick selection

**AnnotationList** (Current image annotations)
- Show all saved masks for current image
- Click to highlight/select
- Delete button per annotation
- Class label and statistics

**KeyboardHelp** (Shortcut reference)
- Toggle with `?` or `H`
- List all keyboard shortcuts
- Grouped by category

---

## Phase 3: Interactive Labelling Features

### 3.1 Click-to-Segment Workflow
**Multi-point prompting before confirmation**

Workflow:
1. User clicks on image (left-click = positive, right-click = negative)
2. Point is added to list and displayed on canvas
3. After each click, call SAM API with all current points
4. Display preview mask (semi-transparent overlay)
5. User can add more clicks to refine the mask
6. Press `Enter` to save the segmentation with current class
7. Press `Esc` to clear all points without saving

Features:
- Visual feedback for click points (green/red circles)
- Real-time mask preview updates
- Smooth interaction (debounce API calls if needed)
- Clear visual distinction between preview and saved masks

### 3.2 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Save current preview segmentation |
| `Backspace` | Remove last click point |
| `Esc` | Clear all points without saving |
| `Ctrl+Z` | Undo last annotation |
| `Ctrl+Y` or `Ctrl+Shift+Z` | Redo annotation |
| `N` or `→` | Next image |
| `P` or `←` | Previous image |
| `1-9` | Switch to class 1-9 |
| `S` | Toggle segment/select mode |
| `M` | Merge selected annotations (select mode) |
| `B` | Toggle brush tool (select mode, 1 selected) |
| `X` | Toggle brush add/remove mode |
| `[` / `]` | Decrease/increase brush size |
| `V` | Toggle annotation visibility |
| `Delete` | Remove selected annotation(s) |
| `H` or `?` | Show keyboard shortcuts help |
| `+` / `-` | Zoom in/out |
| `Space` | Pan mode (drag to move) |

### 3.3 Multi-class Support
- Define multiple cell types/classes
- Each class has:
  - Unique ID
  - Name
  - Color for visualization
  - Keyboard shortcut (1-9)
- Display class selector UI
- Show current selected class
- Color-code masks by class in visualization
- Export class mappings in COCO format

**Cell Classes:**
| Key | Class Name | Color |
|-----|------------|-------|
| 1 | Transfusion tracheid | Red |
| 2 | Transfusion parenchyma cell | Blue |
| 3 | Endodermis cell | Green |
| 4 | Artefact | Yellow |
| 5 | Other | Grey |

---

## Phase 4: Polish & Export

### 4.1 Undo/Redo System
- Maintain history stack per image
- Track all annotation operations:
  - Add annotation
  - Delete annotation
  - Modify annotation
- Visual feedback when undoing/redoing
- Limit history depth (e.g., 50 operations)

### 4.2 COCO Export
Generate COCO JSON format for training:
```json
{
  "info": {...},
  "licenses": [...],
  "images": [
    {
      "id": 1,
      "file_name": "slice_0001.png",
      "width": 1024,
      "height": 1024
    }
  ],
  "annotations": [
    {
      "id": 1,
      "image_id": 1,
      "category_id": 1,
      "segmentation": [[x1, y1, x2, y2, ...]],
      "area": 1234,
      "bbox": [x, y, width, height],
      "iscrowd": 0
    }
  ],
  "categories": [
    {
      "id": 1,
      "name": "cell_type_1",
      "supercategory": "cell"
    }
  ]
}
```

Export options:
- Export all images
- Export only labeled images
- Include/exclude unlabeled regions
- Generate train/val split

### 4.3 UI Improvements
- **Zoom/Pan**: Detailed labelling of small cells
- **Brightness/Contrast Sliders**: Adjust image display for better visibility (UI-only, does not affect saved data)
  - Brightness slider (-100 to +100)
  - Contrast slider (0.5x to 2x)
  - Reset button to restore defaults
  - Applied via CSS filters for performance
- **Progress indicator**: X/Y images labeled
- **Annotation statistics**:
  - Total annotations per class
  - Average cell size
  - Coverage percentage
- **Save indicator**: Auto-save status
- **Loading states**: API call feedback
- **Error handling**: User-friendly error messages

---

## Technical Decisions & Rationale

### SAM2.1 (Latest Version)
- Better performance than SAM 1.0
- Improved multi-point prompting
- Video support (future: temporal consistency across slices)

### Multi-point Prompting (Not Instant)
- Collect several clicks before confirming
- Allows refinement of segmentation
- Preview mode shows SAM output before saving
- More control over quality

### Separate Encode Step
- Cache image embeddings on backend
- Faster inference for repeated queries
- Reduces computation during interactive labelling

### FastAPI + React Architecture
- FastAPI: Modern async Python, auto-generated docs
- React: Component-based, rich ecosystem
- Clear separation of concerns
- Easy to extend with Grounding DINO later

---

## Future Extensions (Post-MVP)

1. **Grounding DINO Integration**
   - Text-based prompting ("segment all cells")
   - Combined with SAM for automatic labelling
   - Semi-automatic annotation pipeline

2. **3D Consistency**
   - Propagate annotations across slices
   - Track cells in 3D volume
   - Interpolation between labeled slices

3. **Active Learning**
   - Suggest which images to label next
   - Uncertainty-based sampling

4. **Collaborative Labelling**
   - Multi-user support
   - Annotation review/approval workflow

5. **Model Training Integration**
   - Trigger training from UI
   - Monitor training progress
   - A/B testing of model versions

---

## Getting Started

### Backend
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Linting & Type Checking
```bash
cd backend
uv run ruff check .          # Lint
uv run ruff check --fix .    # Lint with auto-fix
uv run basedpyright          # Type check
```

### Pre-commit Hooks
```bash
pre-commit install           # Set up hooks (run once after clone)
pre-commit run --all-files   # Run all hooks manually
```

### Access
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
