import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import annotations, images, sam
from app.config import API_PREFIX, CORS_ORIGINS
from app.models.sam_model import initialize_sam_model

app = FastAPI(
    title="Cell Labelling API",
    description="Backend API for Cell Labelling Web UI using SAM2.1",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(images.router, prefix=API_PREFIX)
app.include_router(sam.router, prefix=API_PREFIX)
app.include_router(annotations.router, prefix=API_PREFIX)

# Initialize SAM model (use mock for testing/weak machines)
use_mock = os.environ.get("USE_MOCK_SAM", "false").lower() == "true"
initialize_sam_model(use_mock=use_mock)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
