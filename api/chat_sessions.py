"""REST API for SQLite-backed chat sessions (ChatGPT-style history)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api import sqlite_store

router = APIRouter(prefix="/api", tags=["sessions"])


class SessionCreateBody(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class SessionPatchBody(BaseModel):
    title: str = Field(..., max_length=200)


@router.get("/sessions")
def api_list_sessions() -> dict[str, Any]:
    return {"sessions": sqlite_store.list_sessions(80)}


@router.post("/sessions")
def api_create_session(body: SessionCreateBody | None = None) -> dict[str, Any]:
    b = body or SessionCreateBody()
    row = sqlite_store.create_session(b.title)
    return {"session": row}


@router.get("/sessions/{session_id}/messages")
def api_get_messages(session_id: str) -> dict[str, Any]:
    if not sqlite_store.session_exists(session_id):
        raise HTTPException(404, "Session not found")
    return {"messages": sqlite_store.get_messages(session_id, limit=500)}


@router.delete("/sessions/{session_id}")
def api_delete_session(session_id: str) -> dict[str, bool]:
    sqlite_store.delete_session(session_id)
    return {"ok": True}


@router.patch("/sessions/{session_id}")
def api_patch_session(session_id: str, body: SessionPatchBody) -> dict[str, bool]:
    if not sqlite_store.session_exists(session_id):
        raise HTTPException(404, "Session not found")
    sqlite_store.set_session_title(session_id, body.title)
    return {"ok": True}


@router.get("/health")
def api_health() -> dict[str, str]:
    return {"status": "ok"}
