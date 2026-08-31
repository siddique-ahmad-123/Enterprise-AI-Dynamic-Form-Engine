"""
PostgreSQL Database Integration for Dynamic Form Assistant.

Provides:
- PostgreSQL connection pooling via psycopg_pool (Sync & Async)
- Chat message persistence (chat_messages table)
- LangGraph Async Checkpointer integration (AsyncPostgresSaver)
- Health check & connection validation
"""

import os
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
    Initializes PostgreSQL database schema (chat_messages table and indexes).
    """
    pool = get_db_pool()
    if pool is None:
        logger.warning("PostgreSQL sync pool not available. Skipping DB schema initialization.")
        return False

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS chat_messages (
                        id BIGSERIAL PRIMARY KEY,
                        thread_id VARCHAR(255) NOT NULL,
                        role VARCHAR(50) NOT NULL,
                        content TEXT NOT NULL,
                        metadata JSONB DEFAULT '{}'::jsonb,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages(thread_id);
                    CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
                    """
                )
                logger.info("PostgreSQL `chat_messages` table and indexes verified.")
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
) -> Optional[Dict[str, Any]]:
    """
    Persists a chat message (user or assistant) into the `chat_messages` table.

    Args:
        thread_id: The conversation/thread identifier.
        role: "user", "assistant", or "system".
        content: The text content of the message.
        metadata: Optional metadata dict (e.g. card_dict, intent, status).

    Returns:
        The inserted record dict or None if storage failed.
    """
    pool = get_db_pool()
    if pool is None:
        return None

    meta_json = json.dumps(metadata or {})
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO chat_messages (thread_id, role, content, metadata)
                    VALUES (%s, %s, %s, %s::jsonb)
                    RETURNING id, thread_id, role, content, metadata, created_at;
                    """,
                    (thread_id, role, content, meta_json),
                )
                row = cur.fetchone()
                return dict(row) if row else None
    except Exception as e:
        logger.error("Failed to save chat message to PostgreSQL: %s", e)
        return None


def get_chat_history(thread_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Retrieves chronological chat messages for a given thread_id.

    Args:
        thread_id: The conversation/thread identifier.
        limit: Maximum number of messages to fetch (default 100).

    Returns:
        List of message dicts ordered by created_at ASC.
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


def get_all_chat_sessions() -> List[Dict[str, Any]]:
    """
    Retrieves all conversation sessions / threads with message count and preview from PostgreSQL.
    """
    pool = get_db_pool()
    if pool is None:
        return []

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT 
                        thread_id,
                        COUNT(*) as message_count,
                        MIN(created_at) as started_at,
                        MAX(created_at) as last_activity,
                        (
                            SELECT content 
                            FROM chat_messages m2 
                            WHERE m2.thread_id = m1.thread_id AND m2.role = 'user'
                            ORDER BY m2.id ASC 
                            LIMIT 1
                        ) as title_preview
                    FROM chat_messages m1
                    GROUP BY thread_id
                    ORDER BY MAX(created_at) DESC;
                    """
                )
                rows = cur.fetchall()
                results = []
                for row in rows:
                    item = dict(row)
                    if item.get("started_at"):
                        item["started_at"] = item["started_at"].isoformat()
                    if item.get("last_activity"):
                        item["last_activity"] = item["last_activity"].isoformat()
                    if not item.get("title_preview"):
                        item["title_preview"] = f"Chat Session ({item.get('thread_id')})"
                    results.append(item)
                return results
    except Exception as e:
        logger.error("Failed to fetch chat sessions: %s", e)
        return []


def delete_chat_history(thread_id: str) -> int:
    """
    Deletes all chat messages for a given thread_id.

    Returns:
        Number of deleted rows.
    """
    pool = get_db_pool()
    if pool is None:
        return 0

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM chat_messages WHERE thread_id = %s;",
                    (thread_id,),
                )
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
