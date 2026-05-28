import aiosqlite
import json
import os
from datetime import datetime, timezone
from typing import Optional

DB_PATH = os.getenv("LOG_DB_PATH", "./logs.db")

# ── Schema ─────────────────────────────────────────────────────────────────────

CREATE_USERS = """
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
)
"""

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

CREATE_MOVIE_FEEDBACK = """
CREATE TABLE IF NOT EXISTS movie_feedback (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL,
    session_id  TEXT,
    movie_title TEXT NOT NULL,
    opinion     TEXT NOT NULL CHECK(opinion IN ('liked', 'disliked')),
    source      TEXT DEFAULT 'post_recommendation',
    timestamp   TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
)
"""

CREATE_TMDB_META_CACHE = """
CREATE TABLE IF NOT EXISTS tmdb_meta_cache (
    title_lower TEXT    PRIMARY KEY,
    tmdb_id     INTEGER,
    genre_ids   TEXT    NOT NULL,
    keyword_ids TEXT    NOT NULL,
    fetched_at  TEXT    NOT NULL
)
"""

CREATE_TMDB_STREAMING_CACHE = """
CREATE TABLE IF NOT EXISTS tmdb_streaming_cache (
    tmdb_id    INTEGER PRIMARY KEY,
    providers  TEXT    NOT NULL,
    fetched_at TEXT    NOT NULL
)
"""

CREATE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_user_session   ON user_events     (session_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_type      ON user_events     (event_type)",
    "CREATE INDEX IF NOT EXISTS idx_user_ts        ON user_events     (server_timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_pipe_session   ON pipeline_events (session_id)",
    "CREATE INDEX IF NOT EXISTS idx_pipe_type      ON pipeline_events (event_type)",
    "CREATE INDEX IF NOT EXISTS idx_pipe_ts        ON pipeline_events (timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_feedback_user  ON movie_feedback  (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_feedback_title ON movie_feedback  (movie_title)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_unique ON movie_feedback (user_id, movie_title)",
]


# ── Init ───────────────────────────────────────────────────────────────────────

async def init_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(CREATE_USERS)
        await db.execute(CREATE_USER_EVENTS)
        await db.execute(CREATE_PIPELINE_EVENTS)
        await db.execute(CREATE_MOVIE_FEEDBACK)
        await db.execute(CREATE_TMDB_META_CACHE)
        await db.execute(CREATE_TMDB_STREAMING_CACHE)
        for idx in CREATE_INDEXES:
            await db.execute(idx)
        await db.commit()


# ── Users ──────────────────────────────────────────────────────────────────────

async def create_user(user_id: str, email: str, username: str, password_hash: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO users (id, email, username, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, email.lower(), username, password_hash, now),
        )
        await db.commit()


async def get_user_by_email(email: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, email, username, password_hash, created_at FROM users WHERE email = ?",
            (email.lower(),),
        ) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None


async def get_user_by_username(username: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, email, username FROM users WHERE username = ?",
            (username,),
        ) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None


async def get_user_by_id(user_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, email, username, created_at FROM users WHERE id = ?",
            (user_id,),
        ) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None


# ── Movie Feedback ─────────────────────────────────────────────────────────────

async def upsert_movie_feedback(
    user_id: str,
    movie_title: str,
    opinion: str,
    session_id: Optional[str] = None,
    source: str = "post_recommendation",
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        # Upsert: if user already rated this movie, update the opinion
        await db.execute(
            """
            INSERT INTO movie_feedback (user_id, session_id, movie_title, opinion, source, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, movie_title)
            DO UPDATE SET opinion=excluded.opinion, source=excluded.source, timestamp=excluded.timestamp
            """,
            (user_id, session_id, movie_title, opinion, source, now),
        )
        await db.commit()


async def get_all_rated_titles(user_id: str) -> set[str]:
    """All movie titles the user has liked or disliked (any source, no limit)."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT movie_title FROM movie_feedback WHERE user_id = ?",
            (user_id,),
        ) as cur:
            rows = await cur.fetchall()
    return {row[0].lower() for row in rows}


async def get_user_feedback_history(user_id: str, limit: int = 20) -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT movie_title, opinion FROM movie_feedback
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (user_id, limit),
        ) as cur:
            rows = await cur.fetchall()

    liked, disliked = [], []
    seen = set()
    for row in rows:
        title = row["movie_title"]
        if title in seen:
            continue
        seen.add(title)
        if row["opinion"] == "liked":
            liked.append(title)
        else:
            disliked.append(title)

    return {"liked": liked, "disliked": disliked}


# ── Event Logging ──────────────────────────────────────────────────────────────

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


# ── TMDB Cache ─────────────────────────────────────────────────────────────────

async def get_cached_movie_meta(title: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT tmdb_id, genre_ids, keyword_ids, fetched_at FROM tmdb_meta_cache WHERE title_lower = ?",
            (title.lower().strip(),),
        ) as cur:
            row = await cur.fetchone()
            if row is None:
                return None
            return {
                "tmdb_id": row["tmdb_id"],
                "genre_ids": json.loads(row["genre_ids"]),
                "keyword_ids": json.loads(row["keyword_ids"]),
                "fetched_at": row["fetched_at"],
            }


async def set_cached_movie_meta(
    title: str,
    tmdb_id: Optional[int],
    genre_ids: list,
    keyword_ids: list,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO tmdb_meta_cache (title_lower, tmdb_id, genre_ids, keyword_ids, fetched_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(title_lower) DO UPDATE SET
                tmdb_id     = excluded.tmdb_id,
                genre_ids   = excluded.genre_ids,
                keyword_ids = excluded.keyword_ids,
                fetched_at  = excluded.fetched_at
            """,
            (title.lower().strip(), tmdb_id, json.dumps(genre_ids), json.dumps(keyword_ids), now),
        )
        await db.commit()


async def get_cached_streaming(tmdb_id: int) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT providers, fetched_at FROM tmdb_streaming_cache WHERE tmdb_id = ?",
            (tmdb_id,),
        ) as cur:
            row = await cur.fetchone()
            if row is None:
                return None
            return {"providers": json.loads(row["providers"]), "fetched_at": row["fetched_at"]}


async def set_cached_streaming(tmdb_id: int, providers: list) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO tmdb_streaming_cache (tmdb_id, providers, fetched_at)
            VALUES (?, ?, ?)
            ON CONFLICT(tmdb_id) DO UPDATE SET
                providers  = excluded.providers,
                fetched_at = excluded.fetched_at
            """,
            (tmdb_id, json.dumps(providers), now),
        )
        await db.commit()


async def insert_pipeline_event(
    event_type: str,
    event_data: dict,
    duration_ms: Optional[int] = None,
    session_id: Optional[str] = None,
    error: Optional[str] = None,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO pipeline_events (session_id, event_type, event_data, duration_ms, error, timestamp) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (session_id, event_type, json.dumps(event_data), duration_ms, error, now),
        )
        await db.commit()
