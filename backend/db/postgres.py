"""
PostgreSQL Database Integration for Dynamic Form Assistant.

Provides:
- PostgreSQL connection pooling via psycopg_pool (Sync & Async)
- Chat message persistence (chat_messages table)
- LangGraph Async Checkpointer integration (AsyncPostgresSaver)
- Health check & connection validation
"""

import os
import time
from datetime import datetime, timezone
import json
import logging
from typing import Dict, Any, List, Optional
import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool, AsyncConnectionPool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

logger = logging.getLogger(__name__)

# Global connection pools and checkpointers
_db_pool: Optional[ConnectionPool] = None
_async_pool: Optional[AsyncConnectionPool] = None
_async_checkpointer: Optional[AsyncPostgresSaver] = None


def get_db_uri() -> str:
    """
    Constructs the PostgreSQL connection URI from environment variables.
    Supports DATABASE_URL, POSTGRES_URI, or discrete POSTGRES_* configuration parameters.
    """
    raw_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URI")
    if raw_url:
        return raw_url

    host = os.getenv("POSTGRES_HOST", "postgres-db")
    port = os.getenv("POSTGRES_PORT", "5432")
    dbname = os.getenv("POSTGRES_DB", "myapp")
    user = os.getenv("POSTGRES_USER", "admin")
    password = os.getenv("POSTGRES_PASSWORD", "admin")
    sslmode = os.getenv("POSTGRES_SSLMODE", "prefer")

    return f"postgresql://{user}:{password}@{host}:{port}/{dbname}?sslmode={sslmode}"


def get_db_pool() -> Optional[ConnectionPool]:
    """
    Returns or initializes the global sync psycopg ConnectionPool.
    """
    global _db_pool
    if _db_pool is not None and not _db_pool.closed:
        return _db_pool

    uri = get_db_uri()
    try:
        _db_pool = ConnectionPool(
            conninfo=uri,
            max_size=int(os.getenv("POSTGRES_MAX_CONNECTIONS", "20")),
            kwargs={"autocommit": True, "row_factory": dict_row},
            open=False,
        )
        _db_pool.open()
        logger.info("Connected to PostgreSQL sync pool at %s", uri.split("@")[-1])
        return _db_pool
    except Exception as e:
        logger.warning("Could not connect to PostgreSQL sync pool: %s", e)
        _db_pool = None
        return None


def get_async_checkpointer() -> Optional[AsyncPostgresSaver]:
    """
    Returns or initializes the LangGraph AsyncPostgresSaver checkpointer.
    """
    global _async_pool, _async_checkpointer
    if _async_checkpointer is not None:
        return _async_checkpointer

    uri = get_db_uri()
    try:
        _async_pool = AsyncConnectionPool(
            conninfo=uri,
            max_size=int(os.getenv("POSTGRES_MAX_CONNECTIONS", "20")),
            kwargs={"autocommit": True, "row_factory": dict_row},
            open=False,
        )
        _async_checkpointer = AsyncPostgresSaver(_async_pool)
        logger.info("Initialized AsyncPostgresSaver checkpointer.")
        return _async_checkpointer
    except Exception as e:
        logger.warning("Could not initialize AsyncPostgresSaver: %s", e)
        return None


def get_postgres_checkpointer() -> Optional[AsyncPostgresSaver]:
    """Alias for get_async_checkpointer used by graph workflow compilation."""
    return get_async_checkpointer()


def init_db() -> bool:
    """
    Initializes PostgreSQL database schema (chat_messages, user_threads, thread_submissions, users).
    """
    pool = get_db_pool()
    if pool is None:
        logger.warning("PostgreSQL sync pool not available. Skipping DB schema initialization.")
        return False

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # 1. user_threads table
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS user_threads (
                        thread_id VARCHAR(255) PRIMARY KEY,
                        username VARCHAR(255) NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )

                # 2. chat_messages table
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS chat_messages (
                        id BIGSERIAL PRIMARY KEY,
                        thread_id VARCHAR(255) NOT NULL,
                        username VARCHAR(255),
                        role VARCHAR(50) NOT NULL,
                        content TEXT NOT NULL,
                        metadata JSONB DEFAULT '{}'::jsonb,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )
                # Ensure username column is added if chat_messages already existed without it
                cur.execute("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS username VARCHAR(255);")

                # 3. users table
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id BIGSERIAL PRIMARY KEY,
                        username VARCHAR(255) UNIQUE NOT NULL,
                        hashed_password TEXT NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        last_login TIMESTAMP WITH TIME ZONE
                    );
                    """
                )

                # 4. thread_submissions table
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS thread_submissions (
                        id BIGSERIAL PRIMARY KEY,
                        thread_id VARCHAR(255) UNIQUE NOT NULL,
                        username VARCHAR(255),
                        submission_ref VARCHAR(50) NOT NULL,
                        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )

                # 5. thread_form_state table (stores full form field values for each thread)
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS thread_form_state (
                        thread_id VARCHAR(255) PRIMARY KEY,
                        username VARCHAR(255),
                        field_values JSONB DEFAULT '{}'::jsonb,
                        selected_tab VARCHAR(255) DEFAULT 'tab_consents',
                        journey_status VARCHAR(100) DEFAULT 'IN_PROGRESS',
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )

                # Ensure extra columns exist
                cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS submission_ref VARCHAR(50);")
                cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;")
                cur.execute("ALTER TABLE thread_submissions ADD COLUMN IF NOT EXISTS username VARCHAR(255);")
                cur.execute("ALTER TABLE thread_form_state ADD COLUMN IF NOT EXISTS username VARCHAR(255);")
                cur.execute("ALTER TABLE thread_form_state ADD COLUMN IF NOT EXISTS field_values JSONB DEFAULT '{}'::jsonb;")
                cur.execute("ALTER TABLE thread_form_state ADD COLUMN IF NOT EXISTS selected_tab VARCHAR(255) DEFAULT 'tab_consents';")
                cur.execute("ALTER TABLE thread_form_state ADD COLUMN IF NOT EXISTS journey_status VARCHAR(100) DEFAULT 'IN_PROGRESS';")

                # 6. Indexes
                cur.execute("CREATE INDEX IF NOT EXISTS idx_user_threads_username ON user_threads(username);")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages(thread_id);")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_username ON chat_messages(username);")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_thread_submissions_thread_id ON thread_submissions(thread_id);")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_thread_submissions_username ON thread_submissions(username);")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_thread_form_state_username ON thread_form_state(username);")

                # 7. Backfill and sync user associations
                cur.execute(
                    """
                    -- Link chat_messages username from thread_submissions
                    UPDATE chat_messages cm
                    SET username = ts.username
                    FROM thread_submissions ts
                    WHERE cm.thread_id = ts.thread_id
                      AND (cm.username IS NULL OR cm.username = '')
                      AND ts.username IS NOT NULL AND ts.username != '';

                    -- Link chat_messages username from user_threads
                    UPDATE chat_messages cm
                    SET username = ut.username
                    FROM user_threads ut
                    WHERE cm.thread_id = ut.thread_id
                      AND (cm.username IS NULL OR cm.username = '')
                      AND ut.username IS NOT NULL AND ut.username != '';

                    -- Link thread_submissions username from user_threads or chat_messages
                    UPDATE thread_submissions ts
                    SET username = COALESCE(ut.username, cm.username)
                    FROM user_threads ut
                    LEFT JOIN chat_messages cm ON cm.thread_id = ut.thread_id AND cm.username IS NOT NULL AND cm.username != ''
                    WHERE ts.thread_id = ut.thread_id
                      AND (ts.username IS NULL OR ts.username = '')
                      AND (ut.username IS NOT NULL OR cm.username IS NOT NULL);

                    -- Populate user_threads from chat_messages
                    INSERT INTO user_threads (thread_id, username, created_at, last_activity)
                    SELECT thread_id, username, MIN(created_at), MAX(created_at)
                    FROM chat_messages
                    WHERE username IS NOT NULL AND username != ''
                    GROUP BY thread_id, username
                    ON CONFLICT (thread_id) DO UPDATE SET 
                        username = COALESCE(user_threads.username, EXCLUDED.username),
                        last_activity = GREATEST(user_threads.last_activity, EXCLUDED.last_activity);

                    -- Populate user_threads from thread_submissions
                    INSERT INTO user_threads (thread_id, username, created_at, last_activity)
                    SELECT thread_id, username, submitted_at, submitted_at
                    FROM thread_submissions
                    WHERE username IS NOT NULL AND username != ''
                    ON CONFLICT (thread_id) DO UPDATE SET 
                        username = COALESCE(user_threads.username, EXCLUDED.username);
                    """
                )
                logger.info("PostgreSQL tables and relationships successfully initialized and verified.")
        return True
    except Exception as e:
        logger.error("Error initializing PostgreSQL database schema: %s", e)
        return False


async def ainit_db() -> bool:
    """
    Asynchronously initializes the PostgreSQL database schema and LangGraph checkpointer tables.
    """
    global _async_pool, _async_checkpointer

    # 1. Initialize chat_messages table
    sync_ok = init_db()

    # 2. Open async pool and setup checkpointer tables
    checkpointer = get_async_checkpointer()
    if checkpointer is not None and _async_pool is not None:
        try:
            if _async_pool.closed:
                await _async_pool.open()
            await checkpointer.setup()
            logger.info("LangGraph AsyncPostgresSaver checkpointer schema verified.")
            return True
        except Exception as e:
            logger.error("Error verifying AsyncPostgresSaver schema: %s", e)
            return False

    return sync_ok


def save_chat_message(
    thread_id: str,
    role: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None,
    username: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Persists a chat message (user or assistant) into the `chat_messages` table.
    """
    pool = get_db_pool()
    if pool is None:
        return None

    meta_json = json.dumps(metadata or {})
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # If username not explicitly provided, resolve from user_threads, thread_submissions, or chat_messages
                if not username:
                    cur.execute("SELECT username FROM user_threads WHERE thread_id = %s AND username IS NOT NULL AND username != '' LIMIT 1;", (thread_id,))
                    r0 = cur.fetchone()
                    if r0 and r0.get("username"):
                        username = r0.get("username")
                    else:
                        cur.execute("SELECT username FROM thread_submissions WHERE thread_id = %s AND username IS NOT NULL AND username != '' LIMIT 1;", (thread_id,))
                        r2 = cur.fetchone()
                        if r2 and r2.get("username"):
                            username = r2.get("username")
                        else:
                            cur.execute("SELECT username FROM chat_messages WHERE thread_id = %s AND username IS NOT NULL AND username != '' LIMIT 1;", (thread_id,))
                            r = cur.fetchone()
                            if r and r.get("username"):
                                username = r.get("username")

                cur.execute(
                    """
                    INSERT INTO chat_messages (thread_id, role, content, metadata, username)
                    VALUES (%s, %s, %s, %s::jsonb, %s)
                    RETURNING id, thread_id, role, content, metadata, username, created_at;
                    """,
                    (thread_id, role, content, meta_json, username),
                )
                row = cur.fetchone()

                if username:
                    cur.execute(
                        """
                        INSERT INTO user_threads (thread_id, username, created_at, last_activity)
                        VALUES (%s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT (thread_id) DO UPDATE SET
                            last_activity = CURRENT_TIMESTAMP,
                            username = COALESCE(user_threads.username, EXCLUDED.username);
                        """,
                        (thread_id, username),
                    )
                return dict(row) if row else None
    except Exception as e:
        logger.error("Failed to save chat message to PostgreSQL: %s", e)
        return None


def get_chat_history(thread_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Retrieves chronological chat messages for a given thread_id.
    """
    pool = get_db_pool()
    if pool is None:
        return []

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, thread_id, role, content, metadata, created_at
                    FROM chat_messages
                    WHERE thread_id = %s
                    ORDER BY created_at ASC
                    LIMIT %s;
                    """,
                    (thread_id, limit),
                )
                rows = cur.fetchall()
                results = []
                for row in rows:
                    item = dict(row)
                    if item.get("created_at"):
                        item["created_at"] = item["created_at"].isoformat()
                    results.append(item)
                return results
    except Exception as e:
        logger.error("Failed to fetch chat history for thread '%s': %s", thread_id, e)
        return []


def get_all_chat_sessions(username: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieves conversation sessions / threads with message count, submission status, and preview from PostgreSQL.
    If username is provided, filters strictly for that user's threads.
    """
    pool = get_db_pool()
    if pool is None:
        return []

    clean_user = username.strip() if username else None
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                base_sql = """
                    SELECT 
                        u.thread_id,
                        COALESCE(stats.msg_count, 0) AS message_count,
                        COALESCE(stats.min_created, ts.submitted_at, ut.created_at, CURRENT_TIMESTAMP) AS started_at,
                        COALESCE(stats.max_created, ts.submitted_at, ut.last_activity, CURRENT_TIMESTAMP) AS last_activity,
                        COALESCE(stats.preview, CASE WHEN ts.submission_ref IS NOT NULL THEN 'Submitted Mortgage Application' ELSE 'Loan Application Chat' END) AS title_preview,
                        ts.submission_ref,
                        ts.submitted_at
                    FROM (
                        SELECT thread_id, username FROM user_threads WHERE username IS NOT NULL AND username != ''
                        UNION
                        SELECT thread_id, username FROM thread_submissions WHERE username IS NOT NULL AND username != ''
                        UNION
                        SELECT thread_id, username FROM chat_messages WHERE username IS NOT NULL AND username != ''
                    ) u
                    LEFT JOIN user_threads ut ON ut.thread_id = u.thread_id
                    LEFT JOIN thread_submissions ts ON ts.thread_id = u.thread_id
                    LEFT JOIN (
                        SELECT 
                            m.thread_id,
                            COUNT(m.id) AS msg_count,
                            MIN(m.created_at) AS min_created,
                            MAX(m.created_at) AS max_created,
                            (
                                SELECT m2.content 
                                FROM chat_messages m2 
                                WHERE m2.thread_id = m.thread_id AND m2.role = 'user' 
                                ORDER BY m2.id ASC 
                                LIMIT 1
                            ) AS preview
                        FROM chat_messages m
                        GROUP BY m.thread_id
                    ) stats ON stats.thread_id = u.thread_id
                """
                if clean_user:
                    query = base_sql + """
                        WHERE LOWER(u.username) = LOWER(%s)
                        ORDER BY COALESCE(stats.max_created, ts.submitted_at, ut.last_activity, CURRENT_TIMESTAMP) DESC;
                    """
                    cur.execute(query, (clean_user,))
                else:
                    query = base_sql + """
                        ORDER BY COALESCE(stats.max_created, ts.submitted_at, ut.last_activity, CURRENT_TIMESTAMP) DESC;
                    """
                    cur.execute(query)

                rows = cur.fetchall()
                results = []
                seen_threads = set()
                for row in rows:
                    item = dict(row)
                    tid = item.get("thread_id")
                    if tid in seen_threads:
                        continue
                    seen_threads.add(tid)
                    if item.get("started_at"):
                        item["started_at"] = item["started_at"].isoformat()
                    if item.get("last_activity"):
                        item["last_activity"] = item["last_activity"].isoformat()
                    if item.get("submitted_at"):
                        item["submitted_at"] = item["submitted_at"].isoformat()
                    item["is_submitted"] = bool(item.get("submission_ref"))
                    if not item.get("title_preview"):
                        item["title_preview"] = f"Chat Session ({tid[-8:] if tid else ''})"
                    results.append(item)
                return results
    except Exception as e:
        logger.error("Failed to fetch chat sessions: %s", e)
        return []


def delete_chat_history(thread_id: str) -> int:
    """
    Deletes all chat messages, thread registration, form state, and submission records for a given thread_id.
    """
    pool = get_db_pool()
    if pool is None:
        return 0

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM thread_form_state WHERE thread_id = %s;", (thread_id,))
                cur.execute("DELETE FROM user_threads WHERE thread_id = %s;", (thread_id,))
                cur.execute("DELETE FROM thread_submissions WHERE thread_id = %s;", (thread_id,))
                cur.execute("DELETE FROM chat_messages WHERE thread_id = %s;", (thread_id,))
                return cur.rowcount
    except Exception as e:
        logger.error("Failed to delete chat history for thread '%s': %s", thread_id, e)
        return 0


def check_db_health() -> Dict[str, Any]:
    """
    Checks the status of the PostgreSQL database connection.
    """
    pool = get_db_pool()
    if pool is None:
        return {
            "status": "disconnected",
            "message": "PostgreSQL connection pool could not be established."
        }

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 AS alive, current_database() AS dbname, version() AS version;")
                row = cur.fetchone()
                return {
                    "status": "connected",
                    "database": row.get("dbname"),
                    "version": row.get("version"),
                }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


# ── User Authentication ────────────────────────────────────────────

def create_user(username: str, hashed_password: str) -> Optional[Dict[str, Any]]:
    """Inserts a new user row. Returns the row or None if username already exists."""
    pool = get_db_pool()
    if pool is None:
        return None
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (username, hashed_password)
                    VALUES (%s, %s)
                    RETURNING id, username, created_at;
                    """,
                    (username, hashed_password),
                )
                row = cur.fetchone()
                if row:
                    item = dict(row)
                    if item.get("created_at"):
                        item["created_at"] = item["created_at"].isoformat()
                    return item
    except Exception as e:
        logger.warning("create_user failed for '%s': %s", username, e)
    return None


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Returns the user row (including hashed_password) or None."""
    pool = get_db_pool()
    if pool is None:
        return None
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, username, hashed_password, created_at FROM users WHERE username = %s;",
                    (username,),
                )
                row = cur.fetchone()
                return dict(row) if row else None
    except Exception as e:
        logger.warning("get_user_by_username failed for '%s': %s", username, e)
    return None


def update_user_last_login(username: str) -> None:
    """Stamps last_login to now for the given user."""
    pool = get_db_pool()
    if pool is None:
        return
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE username = %s;",
                    (username,),
                )
    except Exception as e:
        logger.warning("update_user_last_login failed for '%s': %s", username, e)


def mark_user_submitted(username: str, submission_ref: str) -> bool:
    """Stamps submission_ref and submitted_at for the user. No-op if already submitted."""
    pool = get_db_pool()
    if pool is None:
        return False
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE users
                    SET submission_ref = %s, submitted_at = CURRENT_TIMESTAMP
                    WHERE username = %s AND submission_ref IS NULL;
                    """,
                    (submission_ref, username),
                )
                return cur.rowcount > 0
    except Exception as e:
        logger.warning("mark_user_submitted failed for '%s': %s", username, e)
    return False


def get_submission_status(username: str) -> Optional[Dict[str, Any]]:
    """Returns {submission_ref, submitted_at} for the user, or None on error."""
    pool = get_db_pool()
    if pool is None:
        return None
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT submission_ref, submitted_at FROM users WHERE username = %s;",
                    (username,),
                )
                row = cur.fetchone()
                if row:
                    item = dict(row)
                    if item.get("submitted_at"):
                        item["submitted_at"] = item["submitted_at"].isoformat()
                    return item
    except Exception as e:
        logger.warning("get_submission_status failed for '%s': %s", username, e)
    return None


def get_or_create_user_thread(username: str) -> Dict[str, Any]:
    """
    Returns the single canonical persistent thread for the specified user.
    Enforces 'One User = One Persistent Thread & One-Time Journey'.
    If the user has an existing thread, returns it along with form state, messages, and submission status.
    If no thread exists, creates a deterministic thread (e.g. 'thread_usr_<username>') and registers it.
    """
    clean_user = (username or "").strip()
    if not clean_user:
        return {
            "thread_id": "thread_anonymous",
            "username": "anonymous",
            "is_submitted": False,
            "submission_ref": None,
            "submitted_at": None,
            "field_values": {},
            "selected_tab": "tab_consents",
            "journey_status": "IN_PROGRESS",
        }

    pool = get_db_pool()
    canonical_thread_id = f"thread_usr_{clean_user.lower()}"

    if pool is None:
        return {
            "thread_id": canonical_thread_id,
            "username": clean_user,
            "is_submitted": False,
            "submission_ref": None,
            "submitted_at": None,
            "field_values": {},
            "selected_tab": "tab_consents",
            "journey_status": "IN_PROGRESS",
        }

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # 1. Find existing thread for this username in user_threads
                cur.execute(
                    """
                    SELECT thread_id FROM user_threads 
                    WHERE LOWER(username) = LOWER(%s) 
                    ORDER BY created_at ASC 
                    LIMIT 1;
                    """,
                    (clean_user,),
                )
                row = cur.fetchone()
                if row and row.get("thread_id"):
                    canonical_thread_id = row["thread_id"]
                else:
                    # 2. Check thread_submissions
                    cur.execute(
                        """
                        SELECT thread_id FROM thread_submissions 
                        WHERE LOWER(username) = LOWER(%s) 
                        ORDER BY submitted_at ASC 
                        LIMIT 1;
                        """,
                        (clean_user,),
                    )
                    sub_row = cur.fetchone()
                    if sub_row and sub_row.get("thread_id"):
                        canonical_thread_id = sub_row["thread_id"]
                    else:
                        # 3. Check thread_form_state
                        cur.execute(
                            """
                            SELECT thread_id FROM thread_form_state 
                            WHERE LOWER(username) = LOWER(%s) 
                            ORDER BY updated_at ASC 
                            LIMIT 1;
                            """,
                            (clean_user,),
                        )
                        fstate_row = cur.fetchone()
                        if fstate_row and fstate_row.get("thread_id"):
                            canonical_thread_id = fstate_row["thread_id"]
                        else:
                            # 4. Check chat_messages
                            cur.execute(
                                """
                                SELECT thread_id FROM chat_messages 
                                WHERE LOWER(username) = LOWER(%s) 
                                ORDER BY created_at ASC 
                                LIMIT 1;
                                """,
                                (clean_user,),
                            )
                            cmsg_row = cur.fetchone()
                            if cmsg_row and cmsg_row.get("thread_id"):
                                canonical_thread_id = cmsg_row["thread_id"]

                # Ensure canonical thread is registered in user_threads
                cur.execute(
                    """
                    INSERT INTO user_threads (thread_id, username, created_at, last_activity)
                    VALUES (%s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT (thread_id) DO UPDATE SET
                        username = EXCLUDED.username,
                        last_activity = CURRENT_TIMESTAMP;
                    """,
                    (canonical_thread_id, clean_user),
                )

                # Link any orphan chat_messages or submissions for this thread
                cur.execute(
                    "UPDATE chat_messages SET username = %s WHERE thread_id = %s AND (username IS NULL OR username = '');",
                    (clean_user, canonical_thread_id),
                )
                cur.execute(
                    "UPDATE thread_submissions SET username = %s WHERE thread_id = %s AND (username IS NULL OR username = '');",
                    (clean_user, canonical_thread_id),
                )
                cur.execute(
                    "UPDATE thread_form_state SET username = %s WHERE thread_id = %s AND (username IS NULL OR username = '');",
                    (clean_user, canonical_thread_id),
                )

        # Get full state & submission info
        sub_status = get_submission_status(clean_user) or get_thread_submission_status(canonical_thread_id)
        is_sub = bool(sub_status and sub_status.get("submission_ref"))
        form_state = get_thread_form_state(canonical_thread_id)

        return {
            "thread_id": canonical_thread_id,
            "username": clean_user,
            "is_submitted": is_sub,
            "submission_ref": sub_status.get("submission_ref") if sub_status else None,
            "submitted_at": sub_status.get("submitted_at") if sub_status else None,
            "field_values": form_state.get("field_values", {}),
            "selected_tab": "tab_decision" if is_sub else form_state.get("selected_tab", "tab_consents"),
            "journey_status": "SUBMITTED" if is_sub else form_state.get("journey_status", "IN_PROGRESS"),
        }
    except Exception as e:
        logger.warning("get_or_create_user_thread failed for '%s': %s", clean_user, e)
        return {
            "thread_id": canonical_thread_id,
            "username": clean_user,
            "is_submitted": False,
            "submission_ref": None,
            "submitted_at": None,
            "field_values": {},
            "selected_tab": "tab_consents",
            "journey_status": "IN_PROGRESS",
        }


def mark_thread_submitted(thread_id: str, submission_ref: str, username: Optional[str] = None) -> bool:
    """
    Records a completed application submission for a specific thread_id.
    Updates username if previously missing.
    """
    pool = get_db_pool()
    if pool is None:
        return False
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                if not username:
                    cur.execute("SELECT username FROM user_threads WHERE thread_id = %s AND username IS NOT NULL AND username != '' LIMIT 1;", (thread_id,))
                    r0 = cur.fetchone()
                    if r0 and r0.get("username"):
                        username = r0.get("username")
                    else:
                        cur.execute("SELECT username FROM chat_messages WHERE thread_id = %s AND username IS NOT NULL AND username != '' LIMIT 1;", (thread_id,))
                        r = cur.fetchone()
                        if r and r.get("username"):
                            username = r.get("username")

                cur.execute(
                    """
                    INSERT INTO thread_submissions (thread_id, username, submission_ref, submitted_at)
                    VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (thread_id) DO UPDATE SET
                        submission_ref = EXCLUDED.submission_ref,
                        username = COALESCE(EXCLUDED.username, thread_submissions.username),
                        submitted_at = CURRENT_TIMESTAMP;
                    """,
                    (thread_id, username, submission_ref),
                )
                if username:
                    cur.execute(
                        """
                        INSERT INTO user_threads (thread_id, username, created_at, last_activity)
                        VALUES (%s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT (thread_id) DO UPDATE SET
                            username = EXCLUDED.username,
                            last_activity = CURRENT_TIMESTAMP;
                        """,
                        (thread_id, username),
                    )
                    cur.execute(
                        "UPDATE chat_messages SET username = %s WHERE thread_id = %s AND (username IS NULL OR username = '');",
                        (username, thread_id),
                    )
                    cur.execute(
                        """
                        UPDATE users
                        SET submission_ref = %s, submitted_at = CURRENT_TIMESTAMP
                        WHERE username = %s AND submission_ref IS NULL;
                        """,
                        (submission_ref, username),
                    )
                cur.execute(
                    """
                    UPDATE thread_form_state
                    SET journey_status = 'SUBMITTED', updated_at = CURRENT_TIMESTAMP
                    WHERE thread_id = %s;
                    """,
                    (thread_id,),
                )
                return cur.rowcount > 0
    except Exception as e:
        logger.warning("mark_thread_submitted failed for thread '%s': %s", thread_id, e)
        return False


def associate_thread_user(thread_id: str, username: str) -> None:
    """Associates a thread_id with a username in user_threads, chat_messages, and thread_submissions."""
    if not thread_id or not username:
        return
    pool = get_db_pool()
    if pool is None:
        return
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO user_threads (thread_id, username, created_at, last_activity)
                    VALUES (%s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT (thread_id) DO UPDATE SET 
                        username = EXCLUDED.username,
                        last_activity = CURRENT_TIMESTAMP;
                    """,
                    (thread_id, username),
                )
                cur.execute(
                    "UPDATE chat_messages SET username = %s WHERE thread_id = %s AND (username IS NULL OR username = '');",
                    (username, thread_id),
                )
                cur.execute(
                    "UPDATE thread_submissions SET username = %s WHERE thread_id = %s AND (username IS NULL OR username = '');",
                    (username, thread_id),
                )
    except Exception as e:
        logger.warning("associate_thread_user failed for '%s'/'%s': %s", thread_id, username, e)


def get_thread_submission_status(thread_id: str) -> Optional[Dict[str, Any]]:
    """
    Returns {thread_id, username, submission_ref, submitted_at} for a thread, or None if not submitted.
    """
    pool = get_db_pool()
    if pool is None:
        return None
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT thread_id, username, submission_ref, submitted_at FROM thread_submissions WHERE thread_id = %s;",
                    (thread_id,),
                )
                row = cur.fetchone()
                if row:
                    item = dict(row)
                    if item.get("submitted_at"):
                        item["submitted_at"] = item["submitted_at"].isoformat()
                    return item
    except Exception as e:
        logger.warning("get_thread_submission_status failed for thread '%s': %s", thread_id, e)
    return None


def extract_fields_from_chat_history(thread_id: str, cur) -> Dict[str, Any]:
    """
    Extracts and aggregates all field values recorded across all messages in chat_messages for thread_id.
    """
    cur.execute(
        """
        SELECT role, content, metadata FROM chat_messages 
        WHERE thread_id = %s 
        ORDER BY id ASC;
        """,
        (thread_id,),
    )
    msgs = cur.fetchall()
    recovered: Dict[str, Any] = {}

    for m in msgs:
        meta = m.get("metadata") or {}
        ctype = meta.get("card_type")
        flabel = meta.get("field_label")

        # 1. Consent updates
        if flabel == "Consents & Declarations" or ctype == "confirm_consent" or "Agreement Declarations Confirmed" in meta.get("title", ""):
            recovered["isCheckedTermandCond"] = True
            recovered["isCheckedLifestyle"] = True
            recovered["isCheckedPrivacy"] = True
            recovered["agreeTerms"] = True
            recovered["agreeLifestyle"] = True
            recovered["agreePrivacy"] = True

        # 2. updated_fields list: [{"node_id": "borrowerName", "new_value": "Ali Ahmad"}, ...]
        for u in meta.get("updated_fields", []):
            if isinstance(u, dict) and u.get("node_id") and u.get("new_value") not in (None, ""):
                recovered[u["node_id"]] = u["new_value"]

        # 3. updates list: [{"node_id": "...", "value": "..."}]
        for u in meta.get("updates", []):
            if isinstance(u, dict) and u.get("node_id") and u.get("value") not in (None, ""):
                recovered[u["node_id"]] = u["value"]

        # 4. single field_info or update_success with node_id
        if meta.get("node_id") and meta.get("new_value") not in (None, ""):
            recovered[meta["node_id"]] = meta["new_value"]
        elif meta.get("node_id") and meta.get("value") not in (None, ""):
            recovered[meta["node_id"]] = meta["value"]

        # 5. review_summary tabs: [{"sections": [{"fields": [{"node_id": "...", "value": "..."}]}]}]
        for tab in meta.get("tabs", []):
            if isinstance(tab, dict):
                for sec in tab.get("sections", []):
                    if isinstance(sec, dict):
                        for f in sec.get("fields", []):
                            if isinstance(f, dict) and f.get("node_id") and f.get("value") not in (None, ""):
                                recovered[f["node_id"]] = f["value"]

        # 6. Submission success metadata
        if meta.get("applicant_name") and meta["applicant_name"] not in ("Applicant", ""):
            recovered["borrowerName"] = meta["applicant_name"]
        if meta.get("loan_amount") and meta["loan_amount"] not in ("", None):
            try:
                recovered["loanAmount"] = int(meta["loan_amount"])
            except Exception:
                recovered["loanAmount"] = meta["loan_amount"]

    return recovered


def save_thread_form_state(
    thread_id: str,
    field_values: Dict[str, Any],
    selected_tab: Optional[str] = "tab_consents",
    journey_status: Optional[str] = "IN_PROGRESS",
    username: Optional[str] = None,
) -> bool:
    """
    Persists the full form field values, active tab, and journey status for a specific thread_id.
    Merges non-empty values over existing values to prevent accidental blank overwrites.
    """
    pool = get_db_pool()
    if pool is None or not thread_id:
        return False
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                if not username:
                    cur.execute("SELECT username FROM user_threads WHERE thread_id = %s AND username IS NOT NULL AND username != '' LIMIT 1;", (thread_id,))
                    r0 = cur.fetchone()
                    if r0 and r0.get("username"):
                        username = r0.get("username")
                    else:
                        cur.execute("SELECT username FROM thread_submissions WHERE thread_id = %s AND username IS NOT NULL AND username != '' LIMIT 1;", (thread_id,))
                        r2 = cur.fetchone()
                        if r2 and r2.get("username"):
                            username = r2.get("username")

                # Fetch existing row
                cur.execute("SELECT field_values, journey_status, selected_tab FROM thread_form_state WHERE thread_id = %s;", (thread_id,))
                existing_row = cur.fetchone()
                existing_fvals = existing_row.get("field_values") or {} if existing_row else {}
                existing_jstat = existing_row.get("journey_status") if existing_row else None
                existing_tab = existing_row.get("selected_tab") if existing_row else None

                # Also check if thread was submitted
                cur.execute("SELECT submission_ref FROM thread_submissions WHERE thread_id = %s;", (thread_id,))
                sub_check = cur.fetchone()
                is_sub = bool(sub_check and sub_check.get("submission_ref"))

                # Reconstruct any fields from chat messages
                chat_recovered = extract_fields_from_chat_history(thread_id, cur)

                merged_fvals = dict(chat_recovered)
                for k, v in existing_fvals.items():
                    if k in merged_fvals and merged_fvals[k] and not v:
                        continue
                    if v is not None and v != "":
                        merged_fvals[k] = v
                    elif k not in merged_fvals:
                        merged_fvals[k] = v

                for k, v in (field_values or {}).items():
                    if k in merged_fvals and merged_fvals[k] and not v:
                        continue
                    if v is not None and v != "":
                        merged_fvals[k] = v
                    elif k not in merged_fvals:
                        merged_fvals[k] = v

                effective_jstat = "SUBMITTED" if is_sub else (journey_status or existing_jstat or "IN_PROGRESS")
                effective_tab = selected_tab or existing_tab or "tab_consents"

                fvals_json = json.dumps(merged_fvals)
                cur.execute(
                    """
                    INSERT INTO thread_form_state (thread_id, username, field_values, selected_tab, journey_status, updated_at)
                    VALUES (%s, %s, %s::jsonb, %s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (thread_id) DO UPDATE SET
                        field_values = EXCLUDED.field_values,
                        selected_tab = COALESCE(EXCLUDED.selected_tab, thread_form_state.selected_tab),
                        journey_status = COALESCE(EXCLUDED.journey_status, thread_form_state.journey_status),
                        username = COALESCE(EXCLUDED.username, thread_form_state.username),
                        updated_at = CURRENT_TIMESTAMP;
                    """,
                    (thread_id, username, fvals_json, effective_tab, effective_jstat),
                )
                if username:
                    cur.execute(
                        """
                        INSERT INTO user_threads (thread_id, username, created_at, last_activity)
                        VALUES (%s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT (thread_id) DO UPDATE SET
                            username = EXCLUDED.username,
                            last_activity = CURRENT_TIMESTAMP;
                        """,
                        (thread_id, username),
                    )
                return True
    except Exception as e:
        logger.warning("save_thread_form_state failed for thread '%s': %s", thread_id, e)
        return False


def get_thread_form_state(thread_id: str) -> Dict[str, Any]:
    """
    Retrieves the saved form field values, active tab, and journey status for a thread_id.
    Recovers all field values recorded in chat_messages and ensures full persistence.
    """
    pool = get_db_pool()
    if pool is None or not thread_id:
        return {
            "thread_id": thread_id,
            "field_values": {},
            "selected_tab": "tab_consents",
            "journey_status": "IN_PROGRESS",
            "is_submitted": False,
            "submission_ref": None,
        }
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # 1. Check thread_submissions
                cur.execute("SELECT submission_ref, submitted_at, username FROM thread_submissions WHERE thread_id = %s;", (thread_id,))
                sub_row = cur.fetchone()
                is_sub = bool(sub_row and sub_row.get("submission_ref"))
                sub_ref = sub_row.get("submission_ref") if sub_row else None
                sub_at = sub_row.get("submitted_at").isoformat() if (sub_row and sub_row.get("submitted_at")) else None
                username = sub_row.get("username") if sub_row else None

                # 2. Extract any field values recorded across all chat_messages
                chat_recovered = extract_fields_from_chat_history(thread_id, cur)

                # 3. Check thread_form_state
                cur.execute("SELECT field_values, selected_tab, journey_status, updated_at, username FROM thread_form_state WHERE thread_id = %s;", (thread_id,))
                row = cur.fetchone()

                fvals = dict(chat_recovered)
                stab = "tab_decision" if is_sub else "tab_consents"
                jstat = "SUBMITTED" if is_sub else "IN_PROGRESS"
                uname = username

                if row:
                    stored_fvals = row.get("field_values") or {}
                    for k, v in stored_fvals.items():
                        # If chat recovered a non-empty/truthy value, don't let stored False/empty overwrite it
                        if k in fvals and fvals[k] and not v:
                            continue
                        if v is not None and v != "":
                            fvals[k] = v
                        elif k not in fvals:
                            fvals[k] = v
                    stab = row.get("selected_tab") or stab
                    jstat = "SUBMITTED" if is_sub else (row.get("journey_status") or jstat)
                    uname = row.get("username") or uname

                # Self-heal thread_form_state table in PostgreSQL with complete merged values
                fvals_json = json.dumps(fvals)
                cur.execute(
                    """
                    INSERT INTO thread_form_state (thread_id, username, field_values, selected_tab, journey_status, updated_at)
                    VALUES (%s, %s, %s::jsonb, %s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (thread_id) DO UPDATE SET
                        field_values = EXCLUDED.field_values,
                        selected_tab = COALESCE(EXCLUDED.selected_tab, thread_form_state.selected_tab),
                        journey_status = COALESCE(EXCLUDED.journey_status, thread_form_state.journey_status),
                        username = COALESCE(EXCLUDED.username, thread_form_state.username),
                        updated_at = CURRENT_TIMESTAMP;
                    """,
                    (thread_id, uname, fvals_json, stab, jstat),
                )

                return {
                    "thread_id": thread_id,
                    "username": uname,
                    "field_values": fvals,
                    "selected_tab": stab,
                    "journey_status": jstat,
                    "is_submitted": is_sub,
                    "submission_ref": sub_ref,
                    "submitted_at": sub_at,
                }
    except Exception as e:
        logger.warning("get_thread_form_state failed for '%s': %s", thread_id, e)
        return {
            "thread_id": thread_id,
            "field_values": {},
            "selected_tab": "tab_consents",
            "journey_status": "IN_PROGRESS",
            "is_submitted": False,
            "submission_ref": None,
        }


def create_new_user_thread(username: str) -> Dict[str, Any]:
    """
    Creates a brand new distinct application journey thread for the given user,
    preserving any existing application history.
    """
    clean_user = (username or "").strip()
    if not clean_user:
        clean_user = "anonymous"
    
    ts = int(time.time() * 1000)
    new_thread_id = f"thread_usr_{clean_user.lower()}_{ts}"
    pool = get_db_pool()

    if pool is not None:
        try:
            with pool.connection() as conn:
                with conn.cursor() as cur:
                    # Register new thread
                    cur.execute(
                        """
                        INSERT INTO user_threads (thread_id, username, created_at, last_activity)
                        VALUES (%s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT (thread_id) DO UPDATE SET
                            username = EXCLUDED.username,
                            last_activity = CURRENT_TIMESTAMP;
                        """,
                        (new_thread_id, clean_user),
                    )
                    # Initialize clean form state
                    cur.execute(
                        """
                        INSERT INTO thread_form_state (thread_id, username, field_values, selected_tab, journey_status, updated_at)
                        VALUES (%s, %s, '{}'::jsonb, 'tab_consents', 'IN_PROGRESS', CURRENT_TIMESTAMP)
                        ON CONFLICT (thread_id) DO UPDATE SET
                            journey_status = 'IN_PROGRESS',
                            selected_tab = 'tab_consents',
                            updated_at = CURRENT_TIMESTAMP;
                        """,
                        (new_thread_id, clean_user),
                    )
        except Exception as e:
            logger.error("create_new_user_thread DB insert failed: %s", e)

    return {
        "thread_id": new_thread_id,
        "username": clean_user,
        "is_submitted": False,
        "submission_ref": None,
        "submitted_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "journey_status": "IN_PROGRESS",
        "selected_tab": "tab_consents",
        "field_values": {},
    }


def get_user_applications_summary(username: str) -> Dict[str, Any]:
    """
    Retrieves all application journeys (submitted and drafts) for a user with rich metadata
    for the Dashboard view.
    """
    clean_user = (username or "").strip()
    if not clean_user:
        return {"applications": [], "stats": {"total": 0, "submitted": 0, "in_progress": 0}}

    pool = get_db_pool()
    if pool is None:
        return {"applications": [], "stats": {"total": 0, "submitted": 0, "in_progress": 0}}

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # Find all distinct threads for this user
                cur.execute(
                    """
                    SELECT DISTINCT thread_id FROM (
                        SELECT thread_id FROM user_threads WHERE LOWER(username) = LOWER(%s)
                        UNION
                        SELECT thread_id FROM thread_submissions WHERE LOWER(username) = LOWER(%s)
                        UNION
                        SELECT thread_id FROM thread_form_state WHERE LOWER(username) = LOWER(%s)
                        UNION
                        SELECT thread_id FROM chat_messages WHERE LOWER(username) = LOWER(%s)
                    ) t;
                    """,
                    (clean_user, clean_user, clean_user, clean_user),
                )
                rows = cur.fetchall()
                thread_ids = [r["thread_id"] for r in rows if r.get("thread_id")]

                applications = []
                for tid in thread_ids:
                    # Get state & submissions info
                    state = get_thread_form_state(tid)
                    fvals = state.get("field_values") or {}
                    is_sub = state.get("is_submitted", False)
                    sub_ref = state.get("submission_ref")
                    sub_at = state.get("submitted_at")

                    # Extract metadata for card
                    borrower_name = fvals.get("borrowerName") or clean_user.capitalize()
                    loan_amount = fvals.get("loanAmount") or fvals.get("selectedRequiredAmount")
                    loan_type = fvals.get("loanType") or "Home Purchase Loan"
                    property_addr = fvals.get("propertyAddressLine1") or fvals.get("propertyEmirates") or "UAE Property"
                    sanction_status = fvals.get("sanction_status") or ("Underwriting Sanction Review" if is_sub else "In Progress")

                    # Determine dates
                    cur.execute("SELECT created_at, last_activity FROM user_threads WHERE thread_id = %s;", (tid,))
                    ut_row = cur.fetchone()
                    created_at = ut_row.get("created_at").isoformat() if (ut_row and ut_row.get("created_at")) else None
                    last_act = ut_row.get("last_activity").isoformat() if (ut_row and ut_row.get("last_activity")) else None

                    # Message count
                    cur.execute("SELECT COUNT(id) as msg_count FROM chat_messages WHERE thread_id = %s;", (tid,))
                    c_row = cur.fetchone()
                    msg_count = c_row.get("msg_count", 0) if c_row else 0

                    applications.append({
                        "thread_id": tid,
                        "username": clean_user,
                        "is_submitted": is_sub,
                        "submission_ref": sub_ref,
                        "submitted_at": sub_at,
                        "created_at": created_at or sub_at,
                        "last_activity": last_act or sub_at,
                        "status": sanction_status if is_sub else "In Progress",
                        "borrower_name": borrower_name,
                        "loan_amount": loan_amount,
                        "loan_type": loan_type,
                        "property_address": property_addr,
                        "message_count": msg_count,
                        "filled_fields_count": sum(1 for v in fvals.values() if v not in (None, "", False)),
                    })

                # Sort applications: Submitted first by submitted_at desc, then drafts by last_activity desc
                applications.sort(
                    key=lambda a: (
                        1 if a["is_submitted"] else 0,
                        a["submitted_at"] or a["last_activity"] or a["created_at"] or ""
                    ),
                    reverse=True
                )

                total_count = len(applications)
                submitted_count = sum(1 for a in applications if a["is_submitted"])
                in_prog_count = total_count - submitted_count

                return {
                    "username": clean_user,
                    "applications": applications,
                    "stats": {
                        "total": total_count,
                        "submitted": submitted_count,
                        "in_progress": in_prog_count,
                    }
                }
    except Exception as e:
        logger.error("get_user_applications_summary failed for '%s': %s", clean_user, e)
        return {"applications": [], "stats": {"total": 0, "submitted": 0, "in_progress": 0}}

