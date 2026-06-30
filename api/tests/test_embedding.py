"""Embedder + cache behavior (offline-deterministic provider)."""

from pathlib import Path

from app.services.embedding import EmbeddingCache, HashedEmbedder


def test_hashed_embedder_is_deterministic():
    e = HashedEmbedder(dim=128)
    v1 = e.embed_one("transaction monitoring threshold")
    v2 = e.embed_one("transaction monitoring threshold")
    assert v1 == v2


def test_hashed_embedder_separates_similar_topics():
    e = HashedEmbedder(dim=512)
    a = e.embed_one("transaction monitoring threshold for AML alerts")
    b = e.embed_one("refund eligibility and chargebacks for disputes")
    # Different topics shouldn't be nearly identical (cosine < 0.5).
    cos = sum(x * y for x, y in zip(a, b, strict=True))
    assert cos < 0.5


def test_cache_round_trip(tmp_path: Path):
    cache = EmbeddingCache(path=tmp_path / "cache.json")
    e = HashedEmbedder(dim=64)
    texts = ["one", "two", "three"]
    first = cache.embed_all(e, texts)
    cache.save()

    # Reload from disk; embedder should not be called for the same inputs.
    cache2 = EmbeddingCache(path=tmp_path / "cache.json")
    calls = {"n": 0}

    class CountingEmbedder(HashedEmbedder):
        def embed(self, ts):
            calls["n"] += 1
            return super().embed(ts)

    e2 = CountingEmbedder(dim=64)
    second = cache2.embed_all(e2, texts)
    assert calls["n"] == 0
    assert first == second
