# Clause API

FastAPI backend for Clause. See the [repository README](../README.md) for the
full picture. Quick start:

```bash
uv sync
uv run alembic upgrade head
uv run python -m seed.seed
uv run uvicorn app.main:app --reload
```
