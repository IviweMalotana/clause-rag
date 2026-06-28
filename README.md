# Clause — a RAG compliance copilot

Clause answers compliance and policy questions over a document corpus and
**never answers without citing the source passage**. Every answer carries
numbered inline citations; clicking one opens the source document scrolled to and
highlighting the exact passage. When the corpus can't support an answer, Clause
declines instead of guessing — because in compliance, an uncited answer is
worthless and a hallucinated one is dangerous.

> Demo mode: the app ships with a realistic, fully synthetic fintech compliance
> corpus (an AML policy, a KYC procedure, a PCI-style checklist, and a refunds
> policy) and seeds itself on first run. No login required to explore.

## What it does

- **Ask (chat):** a Perplexity-style answer view — the answer with inline
  `[1][2]` citations, a "sources used" list, and an answer-confidence panel.
- **Document library + reader:** a clean library and an in-app reader that
  highlights the cited passage when you arrive from a citation.
- **Ingestion:** drop a `.md`/`.txt` file (or paste text) and watch it chunk,
  embed, and index with live progress.
- **Trust & evals:** a curated set of question → expected-source pairs that runs
  live against the retriever, plus a demonstration of the no-answer guardrail.

The citation → passage click-through is the core interaction: chunk character
offsets are preserved verbatim through chunking, so highlights land exactly.

## Architecture

```
Browser
  │
  ▼
Next.js 15 (App Router, Tailwind)  ──deploy──▶ Vercel
  │  /ask · /library · /ingest · /trust · / (case study)
  ▼
FastAPI (Python 3.12, uv)          ──deploy──▶ Railway
  │  retrieval · grounded answer · guardrail · ingestion
  ├─▶ OpenAI embeddings (text-embedding-3-small)   [embeddings]
  ├─▶ Claude API (Anthropic)                        [answer generation]
  ▼
Postgres + pgvector                ──deploy──▶ Railway
     documents · chunks (text + embedding + offsets) · conversations · messages · citations
```

**Request flow for an answer:** embed the question → cosine search over pgvector
→ gate results by a per-provider similarity threshold (the guardrail) → ask
Claude to answer strictly from the retrieved passages with inline `[n]` markers →
map markers back to chunks and persist them as citations.

### Repo layout

```
/web    Next.js 15 + TypeScript + Tailwind (frontend)
/api    FastAPI + SQLAlchemy + Alembic (backend), uv-managed
        app/services  chunking · embedding · retrieval · answer · ingest
        seed/         synthetic corpus + seed script + committed embedding cache
docker-compose.yml    local Postgres + pgvector
Makefile              dev task runner
```

### Data model (Postgres + pgvector)

- `documents` — source text, type, status, slug.
- `chunks` — text + `embedding vector` + section/page ref + **char offsets** into
  the document (HNSW cosine index).
- `conversations`, `messages` — chat history; assistant messages carry confidence.
- `citations` — link an inline `[n]` marker to the chunk that grounded it.

## Embeddings & answers (important)

- **Embeddings:** OpenAI `text-embedding-3-small` when `OPENAI_API_KEY` is set.
  Without a key, a deterministic **offline embedder** is used so the demo seeds
  and retrieves with zero setup. The seed corpus's vectors are cached in
  `api/seed/embeddings_cache.json`, so seeding is deterministic and free.
- **Answers:** require `ANTHROPIC_API_KEY` (Claude). Without it, the chat still
  runs retrieval and shows the passages it *would* ground on — only the written
  answer is gated on the key.
- **Guardrail:** if no passage clears the similarity threshold, Clause returns a
  "not supported" answer without calling the model. The threshold is calibrated
  per embedding provider.

## Run locally

Prerequisites: Docker (for Postgres + pgvector), [`uv`](https://docs.astral.sh/uv/),
Node 20+.

```bash
cp .env.example .env          # optional: add OPENAI_API_KEY / ANTHROPIC_API_KEY

make db-up                    # Postgres + pgvector via docker compose
make api-install              # uv sync
make migrate                  # alembic upgrade head
make seed                     # load + index the synthetic corpus

make api                      # backend  → http://localhost:8000  (docs at /docs)
# in a second terminal:
make web-install
make web                      # frontend → http://localhost:3000
```

Open **http://localhost:3000**. `make setup` runs the db/deps/migrate/seed steps
in one go.

> Without `ANTHROPIC_API_KEY`, the chat shows retrieved sources and the passage
> highlight (set the key to generate written answers). Retrieval, the reader,
> ingestion, and the Trust page all work key-free.

## Deploy

### Database (Railway)

Provision a Postgres instance with the **pgvector** extension available (the
initial migration runs `CREATE EXTENSION IF NOT EXISTS vector`). Note its
connection URL.

### API (Railway)

Deploy the `/api` directory using the included `api/Dockerfile`. The container
runs `alembic upgrade head` on start, then serves on `$PORT`.

Set these variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Railway Postgres URL (a plain `postgresql://…` is auto-converted to the psycopg3 driver) |
| `ANTHROPIC_API_KEY` | Anthropic key (required for written answers) |
| `OPENAI_API_KEY` | OpenAI key (required to embed at ingest/seed time) |
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://clause.vercel.app` |

After the first deploy, seed the corpus once (Railway shell or one-off command):

```bash
uv run python -m seed.seed
```

### Web (Vercel)

Import the repo, set the **root directory** to `web`, and add:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | your Railway API URL, e.g. `https://clause-api.up.railway.app` |

## Environment variables

See [`.env.example`](.env.example) (backend) and
[`web/.env.example`](web/.env.example) (frontend). Never commit `.env` — it's
gitignored.

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | api | Postgres + pgvector connection |
| `ANTHROPIC_API_KEY` | api | Claude answer generation |
| `ANTHROPIC_MODEL` | api | defaults to `claude-sonnet-4-6` |
| `OPENAI_API_KEY` | api | embeddings (`text-embedding-3-small`) |
| `EMBEDDING_MODEL` / `EMBEDDING_DIM` | api | embedding model + dimension (1536) |
| `RETRIEVAL_TOP_K` | api | passages retrieved per question |
| `RETRIEVAL_MIN_SCORE` | api | optional guardrail threshold override |
| `CORS_ORIGINS` | api | allowed web origins (comma-separated) |
| `NEXT_PUBLIC_API_BASE_URL` | web | base URL of the API |

## Quality / trust

The `/trust` page runs a curated eval suite live against the retriever and shows
the no-answer guardrail declining out-of-corpus questions. A backend script also
exercises the answer pipeline end-to-end:

```bash
cd api && uv run python -m scripts.validate_answer
```

## Notes

- All corpus content is synthetic and for demonstration only.
- Ingestion progress is tracked in-process (single API instance), which suits the
  demo; a multi-instance deployment would move it to a shared store.
