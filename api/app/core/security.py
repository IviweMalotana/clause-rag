"""Lightweight single-token gate for write actions.

When DEMO_WRITE_TOKEN is unset, writes are open (public demo). When set, callers
must present a matching X-Clause-Token header. This is intentionally minimal —
one shared demo token, no user accounts.
"""

from fastapi import Header, HTTPException

from app.core.config import settings


def writes_protected() -> bool:
    return bool(settings.demo_write_token)


def require_write_token(x_clause_token: str | None = Header(default=None)) -> None:
    if not settings.demo_write_token:
        return  # open demo
    if x_clause_token != settings.demo_write_token:
        raise HTTPException(status_code=401, detail="A valid write token is required.")
