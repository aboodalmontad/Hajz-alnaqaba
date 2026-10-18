from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from backend.app.api.analyze import router as analyze_router
from backend.app.api.compare import router as compare_router
from backend.app.storage.database import init_db
from backend.app.core.config import ANNOTATED_DIR

app = FastAPI(
    title="Fingerprint Analysis and Comparison API",
    description="Backend API for fingerprint image processing, minutiae extraction, and matching.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

# Serve annotated images statically
if os.path.exists(ANNOTATED_DIR):
    app.mount("/api/annotated", StaticFiles(directory=ANNOTATED_DIR), name="annotated")

app.include_router(analyze_router)
app.include_router(compare_router)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Fingerprint backend running successfully"}
