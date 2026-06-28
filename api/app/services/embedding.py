"""Embedding providers + a content-hash cache.

Provider selection:
- If OPENAI_API_KEY is set, embeddings come from OpenAI (the configured real
  provider, e.g. text-embedding-3-small).
- Otherwise a deterministic, offline "hashed" embedder is used so the demo seeds
  and answers with zero setup. Corpus and queries always use the *same* provider,
  so cosine retrieval stays consistent.

The cache (seed/embeddings_cache.json) is keyed by provider+model+text hash. The
seed corpus's vectors are committed there, so `make seed` and redeploys are
deterministic and never re-bill the embedding API.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from abc import ABC, abstractmethod
from collections import Counter
from pathlib import Path

from app.core.config import settings

CACHE_PATH = Path(__file__).resolve().parents[2] / "seed" / "embeddings_cache.json"

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# Common words carry little retrieval signal; dropping them sharpens the
# offline embedder's focus on content terms.
_STOPWORDS = frozenset(
    """a an and are as at be by for from has have how in is it its must not of on
    or that the their this to was were what when where which who will with within
    every all any may which than then these those into out over under more most
    each does do done being been about above after before""".split()
)


class Embedder(ABC):
    provider: str
    model: str
    dim: int
    # Cosine-similarity floor below which a retrieved chunk is treated as not
    # supporting an answer. Calibrated per provider since their score scales
    # differ. Drives the "corpus doesn't support this" guardrail.
    min_score: float

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]: ...

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]


class HashedEmbedder(Embedder):
    """Deterministic offline embedder using a signed hashing trick.

    Cosine similarity over these vectors reflects shared-token overlap, which is
    enough to retrieve the correct passages for the demo and evals without any
    network or API key. Uses hashlib (not Python's salted hash) for stable
    vectors across processes and machines.
    """

    provider = "hashed"
    min_score = 0.09

    def __init__(self, dim: int):
        self.dim = dim
        self.model = f"hashed-v2-{dim}"

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_one(t) for t in texts]

    def _embed_one(self, text: str) -> list[float]:
        words = [w for w in _TOKEN_RE.findall(text.lower()) if w not in _STOPWORDS and len(w) > 1]
        # Unigrams plus adjacent bigrams capture phrases like "front line agent".
        terms = list(words)
        terms += [f"{a}_{b}" for a, b in zip(words, words[1:], strict=False)]

        vec = [0.0] * self.dim
        for term, count in Counter(terms).items():
            weight = 1.0 + math.log(count)  # sublinear term frequency
            for salt in ("", "#"):
                h = int(hashlib.md5((salt + term).encode()).hexdigest(), 16)
                sign = 1.0 if (h >> 12) & 1 else -1.0
                vec[h % self.dim] += sign * weight
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]


class OpenAIEmbedder(Embedder):
    provider = "openai"
    min_score = 0.24

    def __init__(self, api_key: str, model: str, dim: int):
        from openai import OpenAI

        self._client = OpenAI(api_key=api_key)
        self.model = model
        self.dim = dim

    def embed(self, texts: list[str]) -> list[list[float]]:
        resp = self._client.embeddings.create(model=self.model, input=texts)
        return [d.embedding for d in resp.data]


def get_embedder() -> Embedder:
    if settings.openai_api_key:
        return OpenAIEmbedder(
            settings.openai_api_key, settings.embedding_model, settings.embedding_dim
        )
    return HashedEmbedder(settings.embedding_dim)


class EmbeddingCache:
    """JSON-backed cache of text -> embedding, scoped by provider + model."""

    def __init__(self, path: Path = CACHE_PATH):
        self.path = path
        self._store: dict[str, list[float]] = {}
        if path.exists():
            self._store = json.loads(path.read_text(encoding="utf-8"))
        self._dirty = False

    @staticmethod
    def _key(provider: str, model: str, text: str) -> str:
        digest = hashlib.sha1(text.encode("utf-8")).hexdigest()
        return f"{provider}|{model}|{digest}"

    def embed_all(self, embedder: Embedder, texts: list[str]) -> list[list[float]]:
        """Return embeddings for texts, computing+caching only the misses."""
        keys = [self._key(embedder.provider, embedder.model, t) for t in texts]
        missing = [
            (i, t)
            for i, (t, k) in enumerate(zip(texts, keys, strict=True))
            if k not in self._store
        ]
        if missing:
            vectors = embedder.embed([t for _, t in missing])
            for (i, _), vec in zip(missing, vectors, strict=True):
                self._store[keys[i]] = [round(x, 7) for x in vec]
            self._dirty = True
        return [self._store[k] for k in keys]

    def save(self) -> None:
        if self._dirty:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(
                json.dumps(self._store, separators=(",", ":")), encoding="utf-8"
            )
            self._dirty = False
