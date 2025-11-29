# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cell Labelling Web UI for microscopy images using SAM2.1 (Segment Anything Model). A 2-stage approach where labeled data from this tool will train a segmentation model later.

## Architecture

- **Backend**: FastAPI (Python) - REST API for image serving, SAM inference, and annotation management
- **Frontend**: React + Vite (JavaScript) - Interactive canvas for click-to-segment labelling
- **Model**: SAM2.1 for real-time segmentation from user clicks
- **Data**: 3D cell images from `data/raw/rec_8bit_Paganin.zip`, processed as independent 2D slices

## Development Commands

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

### Testing (Backend)
```bash
cd backend
uv run pytest                        # Run all tests
uv run pytest tests/test_foo.py      # Run single file
uv run pytest -k "test_name"         # Run by name pattern
```

### Linting & Type Checking
```bash
cd backend
uv run ruff check .          # Lint
uv run ruff check --fix .    # Lint with auto-fix
uv run basedpyright          # Type check
```

### Pre-commit
```bash
pre-commit install           # Set up hooks (once)
pre-commit run --all-files   # Run manually
```

### Access Points
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Backend Development

Use TDD (Test-Driven Development): write tests first, then implement the code to make them pass.

## Key Design Decisions

- **Multi-point prompting**: Collect several positive/negative clicks before confirming segmentation (not instant on each click)
- **Separate encode step**: Cache image embeddings on backend for faster repeated inference
- **COCO format export**: Standard format for training downstream segmentation models
- **Keyboard-driven workflow**: Extensive shortcuts for efficient labelling (Enter to save, Esc to clear, 1-9 for class selection)
