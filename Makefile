# Clause — developer task runner.
# Most targets wrap the API (uv) or the web app (npm). Run `make help`.

.DEFAULT_GOAL := help
SHELL := /bin/bash

API_DIR := api
WEB_DIR := web

.PHONY: help
help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Infra
# ---------------------------------------------------------------------------
.PHONY: db-up
db-up: ## Start Postgres+pgvector via docker compose
	docker compose up -d
	@echo "Waiting for Postgres to be healthy..."
	@until docker compose exec -T db pg_isready -U clause -d clause >/dev/null 2>&1; do sleep 1; done
	@echo "Postgres is ready."

.PHONY: db-down
db-down: ## Stop the database (keeps data volume)
	docker compose down

.PHONY: db-reset
db-reset: ## Drop the database volume and recreate (DESTRUCTIVE)
	docker compose down -v
	$(MAKE) db-up

# ---------------------------------------------------------------------------
# API (FastAPI + uv)
# ---------------------------------------------------------------------------
.PHONY: api-install
api-install: ## Install backend dependencies with uv
	cd $(API_DIR) && uv sync

.PHONY: migrate
migrate: ## Apply Alembic migrations
	cd $(API_DIR) && uv run alembic upgrade head

.PHONY: api
api: ## Run the FastAPI dev server (http://localhost:8000)
	cd $(API_DIR) && uv run uvicorn app.main:app --reload --port $${API_PORT:-8000}

.PHONY: seed
seed: ## Seed the synthetic compliance corpus + build the vector index
	cd $(API_DIR) && uv run python -m seed.seed

.PHONY: test
test: ## Run the backend pytest suite (needs Postgres + pgvector + clause_test db)
	cd $(API_DIR) && uv run pytest

# ---------------------------------------------------------------------------
# Web (Next.js)
# ---------------------------------------------------------------------------
.PHONY: web-install
web-install: ## Install frontend dependencies
	cd $(WEB_DIR) && npm install

.PHONY: web
web: ## Run the Next.js dev server (http://localhost:3000)
	cd $(WEB_DIR) && npm run dev

# ---------------------------------------------------------------------------
# Convenience
# ---------------------------------------------------------------------------
.PHONY: setup
setup: db-up api-install migrate seed web-install ## One-shot: db + deps + migrate + seed + web deps
	@echo ""
	@echo "Setup complete. Run the app with two terminals:"
	@echo "  make api     # backend on :8000"
	@echo "  make web     # frontend on :3000"
