import aiosqlite
import json
import os
from datetime import datetime, timezone

DB_PATH = os.getenv("LOG_DB_PATH", "./logs.db")

CREATE_USER_EVENTS = """
CREATE TABLE IF NOT EXISTS user_events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       TEXT    NOT NULL,
    event_type       TEXT    NOT NULL,
    page             TEXT,
    event_data       TEXT,
    client_timestamp TEXT,
    server_timestamp TEXT    NOT NULL
)
"""

CREATE_PIPELINE_EVENTS = """
CREATE TABLE IF NOT EXISTS pipeline_events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       TEXT,
    event_type       TEXT    NOT NULL,
    event_data       TEXT,
    duration_ms      INTEGER,
    error            TEXT,
    timestamp        TEXT    NOT NULL
)
"""

CREATE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_user_session   ON user_events     (session_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_type      ON user_events     (event_type)",
    "CREATE INDEX IF NOT EXISTS idx_user_ts        ON user_events     (server_timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_pipe_session   ON pipeline_events (session_id)",
    "CREATE INDEX IF NOT EXISTS idx_pipe_type      ON pipeline_events (event_type)",
    "CREATE INDEX IF NOT EXISTS idx_pipe_ts        ON pipeline_events (timestamp)",
]


async def init_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(CREATE_USER_EVENTS)
        await db.execute(CREATE_PIPELINE_EVENTS)
        for idx in CREATE_INDEXES:
            await db.execute(idx)
        await db.commit()


async def insert_user_events(events: list[dict]) -> None:
    if not events:
        return
    now = datetime.now(timezone.utc).isoformat()
    rows = [
        (
            e.get("session_id", ""),
            e.get("event_type", "unknown"),
            e.get("page"),
            json.dumps(e.get("event_data", {})),
            e.get("client_timestamp"),
            now,
        )
        for e in events
    ]
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executemany(
            "INSERT INTO user_events (session_id, event_type, page, event_data, client_timestamp, server_timestamp) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            rows,
        )
        await db.commit()


async def insert_pipeline_event(
    event_type: str,
    event_data: dict,
    duration_ms: int | None = None,
    session_id: str | None = None,
    error: str | None = None,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO pipeline_events (session_id, event_type, event_data, duration_ms, error, timestamp) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (session_id, event_type, json.dumps(event_data), duration_ms, error, now),
        )
        await db.commit()
