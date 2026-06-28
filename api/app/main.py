"""FastAPI application entrypoint for Clause."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import documents, health

app = FastAPI(
    title="Clause API",
    description="RAG compliance copilot — grounded answers with citations.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(documents.router, prefix="/api")


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "Clause API", "docs": "/docs", "health": "/api/health"}
