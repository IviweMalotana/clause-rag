"""FastAPI application entrypoint for Clause."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.middleware import RequestIdMiddleware
from app.routers import ask, documents, evals, health, ingest

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

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
    expose_headers=["X-Request-Id"],
)
app.add_middleware(RequestIdMiddleware)

app.include_router(health.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(ingest.router, prefix="/api")
app.include_router(ask.router, prefix="/api")
app.include_router(evals.router, prefix="/api")


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "Clause API", "docs": "/docs", "health": "/api/health"}
