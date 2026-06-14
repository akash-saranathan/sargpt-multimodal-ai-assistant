"""
SQLite persistence for chat sessions/messages and KB index bookkeeping.

HOW IT WORKS:
- SQLite is a lightweight, file-based database that is easy to set up and use.
- It is a good choice for small to medium-sized applications.
- It is a good choice for applications that need to be deployed on a single server.
- It is a good choice for applications that need to be deployed on a single server.

TECHNICAL WORKING STEPS IN BULLET POINTS(WORDS): LIKE STEP 1,STEP 2 ETC:
- CREATE TABLES: chat_sessions, chat_messages, kb_indexed_fingerprints, app_kv
- CREATE INDEXES: idx_chat_messages_session
- CREATE FOREIGN KEYS: session_id REFERENCES chat_sessions(id) ON DELETE CASCADE
- CREATE PRAGMAS: foreign_keys = ON
- CREATE VIEWS: None
- CREATE TRIGGERS: None
- CREATE PROCEDURES: None
- CREATE FUNCTIONS: None
"""
from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "app.db"
_lock = threading.Lock()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def get_conn():
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT 'New chat',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                file_name TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_chat_messages_session
                ON chat_messages(session_id, id);

            -- (filename, content_sha256) pairs already embedded in FAISS (dedupe uploads)
            CREATE TABLE IF NOT EXISTS kb_indexed_fingerprints (
                filename TEXT NOT NULL,
                content_sha256 TEXT NOT NULL,
                indexed_at TEXT NOT NULL,
                PRIMARY KEY (filename, content_sha256)
            );

            CREATE TABLE IF NOT EXISTS app_kv (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )


def list_sessions(limit: int = 50) -> list[dict]:
    init_db()
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, title, created_at, updated_at
            FROM chat_sessions
            ORDER BY datetime(updated_at) DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def create_session(title: str | None = None) -> dict:
    init_db()
    sid = str(uuid.uuid4())
    now = _utc_now()
    t = (title or "New chat").strip()[:200] or "New chat"
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO chat_sessions (id, title, created_at, updated_at) VALUES (?,?,?,?)",
            (sid, t, now, now),
        )
    return {"id": sid, "title": t, "created_at": now, "updated_at": now}


def create_session_with_id(session_id: str, title: str | None = None) -> dict:
    init_db()
    now = _utc_now()
    t = (title or "New chat").strip()[:200] or "New chat"
    with get_conn() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO chat_sessions (id, title, created_at, updated_at)
            VALUES (?,?,?,?)
            """,
            (session_id, t, now, now),
        )
    return {"id": session_id, "title": t}


def ensure_session(session_id: str) -> None:
    create_session_with_id(session_id, "New chat")


def delete_session(session_id: str) -> None:
    init_db()
    with get_conn() as conn:
        conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
        conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))


def set_session_title(session_id: str, title: str) -> None:
    init_db()
    now = _utc_now()
    with get_conn() as conn:
        conn.execute(
            "UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?",
            (title.strip()[:200], now, session_id),
        )


def touch_session(session_id: str) -> None:
    now = _utc_now()
    with get_conn() as conn:
        conn.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now, session_id))


def get_messages(session_id: str, limit: int = 100) -> list[dict]:
    init_db()
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT role, content, file_name, created_at
            FROM chat_messages
            WHERE session_id = ?
            ORDER BY id ASC
            LIMIT ?
            """,
            (session_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def append_message(
    session_id: str,
    role: str,
    content: str,
    file_name: str | None = None,
) -> None:
    init_db()
    now = _utc_now()
    with _lock:
        with get_conn() as conn:
            conn.execute(
                """
                INSERT INTO chat_messages (session_id, role, content, file_name, created_at)
                VALUES (?,?,?,?,?)
                """,
                (session_id, role, content, file_name, now),
            )
            conn.execute(
                "UPDATE chat_sessions SET updated_at = ? WHERE id = ?",
                (now, session_id),
            )


def session_exists(session_id: str) -> bool:
    init_db()
    with get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM chat_sessions WHERE id = ?", (session_id,)
        ).fetchone()
    return row is not None


# --- KB index bookkeeping ---


def kb_fingerprint_exists(filename: str, content_sha256: str) -> bool:
    init_db()
    with get_conn() as conn:
        r = conn.execute(
            "SELECT 1 FROM kb_indexed_fingerprints WHERE filename = ? AND content_sha256 = ?",
            (filename, content_sha256),
        ).fetchone()
    return r is not None


def kb_content_sha_already_indexed(content_sha256: str) -> bool:
    """True if this exact file bytes were already embedded (any filename)."""
    init_db()
    with get_conn() as conn:
        r = conn.execute(
            "SELECT 1 FROM kb_indexed_fingerprints WHERE content_sha256 = ?",
            (content_sha256,),
        ).fetchone()
    return r is not None


def kb_register_fingerprint(filename: str, content_sha256: str) -> None:
    init_db()
    now = _utc_now()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO kb_indexed_fingerprints (filename, content_sha256, indexed_at)
            VALUES (?,?,?)
            """,
            (filename, content_sha256, now),
        )


def kb_clear_fingerprints() -> None:
    init_db()
    with get_conn() as conn:
        conn.execute("DELETE FROM kb_indexed_fingerprints")


def kb_get_manifest() -> dict[str, str]:
    """Last persisted kb folder fingerprint: filename -> sha256."""
    init_db()
    with get_conn() as conn:
        row = conn.execute(
            "SELECT value FROM app_kv WHERE key = 'kb_manifest'"
        ).fetchone()
    if not row:
        return {}
    try:
        return json.loads(row[0])
    except json.JSONDecodeError:
        return {}


def kb_set_manifest(manifest: dict[str, str]) -> None:
    init_db()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO app_kv (key, value) VALUES ('kb_manifest', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (json.dumps(manifest, sort_keys=True),),
        )


def kb_clear_manifest() -> None:
    init_db()
    with get_conn() as conn:
        conn.execute("DELETE FROM app_kv WHERE key = 'kb_manifest'")


init_db()
