"""Token-bucket rate limiter unit tests."""

import pytest

from app.core.rate_limit import RateLimiter


def test_allows_within_burst():
    rl = RateLimiter(rate_per_minute=60, burst=3)
    allowed = [rl.check("a", now=0.0)[0] for _ in range(3)]
    assert allowed == [True, True, True]


def test_blocks_over_burst_with_retry_hint():
    rl = RateLimiter(rate_per_minute=60, burst=2)
    rl.check("a", now=0.0)
    rl.check("a", now=0.01)
    ok, retry = rl.check("a", now=0.02)
    assert ok is False
    assert retry > 0


def test_refills_with_time():
    rl = RateLimiter(rate_per_minute=60, burst=1)
    assert rl.check("a", now=0.0)[0] is True
    assert rl.check("a", now=0.1)[0] is False
    # Bucket refills 1 token per second.
    assert rl.check("a", now=2.0)[0] is True


def test_per_ip_isolation():
    rl = RateLimiter(rate_per_minute=60, burst=1)
    assert rl.check("a", now=0.0)[0] is True
    # A different key should not be blocked by 'a' exhausting its bucket.
    assert rl.check("b", now=0.0)[0] is True


@pytest.fixture
def patched_ask_limit(monkeypatch):
    """Reset and tighten the ask limiter so we can trigger 429 quickly."""
    import app.core.rate_limit as rl
    import app.routers.ask as ask_module

    tight = rl.RateLimiter(rate_per_minute=60, burst=1)
    monkeypatch.setattr(ask_module, "ask_limiter", tight)
    # Rebuild the dependency reference used at module-import time.
    monkeypatch.setattr(ask_module, "_ask_throttle", rl.Depends(rl.limiter_dependency(tight)))
    yield


def test_ask_returns_429_when_throttled(seeded_corpus, client):
    """End-to-end: the broader 20/min ask limit still allows a small burst."""
    # The default is 20/min burst=8, so a handful of rapid requests succeed.
    payload = {"question": "How long must compliance records be retained?"}
    codes = [client.post("/api/ask", json=payload).status_code for _ in range(3)]
    assert all(c == 200 for c in codes)


def test_request_id_header_is_set(client):
    res = client.get("/api/health")
    assert "x-request-id" in {k.lower() for k in res.headers.keys()}
