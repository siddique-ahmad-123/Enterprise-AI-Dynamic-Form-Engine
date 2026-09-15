"""
AI-Powered Dynamic Form Assistant — FastAPI Backend

LangGraph agent backend, served as a native AG-UI HTTP endpoint.
The Node.js CopilotRuntime connects here via HttpAgent using the AG-UI protocol.
"""

import os
import base64
import logging
import warnings
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import bcrypt
from jose import jwt
from pydantic import BaseModel, field_validator

from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint
from graph.workflow import form_graph, create_form_graph
from db.postgres import (
    init_db,
    ainit_db,
    get_async_checkpointer,
    save_chat_message,
    get_chat_history,
    get_all_chat_sessions,
    delete_chat_history,
    check_db_health,
    create_user,
    get_user_by_username,
    update_user_last_login,
    mark_user_submitted,
    get_submission_status,
    mark_thread_submitted,
    get_thread_submission_status,
    associate_thread_user,
    save_thread_form_state,
    get_thread_form_state,
    get_or_create_user_thread,
    create_new_user_thread,
    get_user_applications_summary,
)

warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
)

logger = logging.getLogger(__name__)

load_dotenv()

# ── Auth config ──────────────────────────────────────────────────
_JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-use-a-long-random-string")
_JWT_ALGORITHM = "HS256"
_JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "8"))


class AuthRequest(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_must_be_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 50:
            raise ValueError("Username must be between 3 and 50 characters.")
        return v

    @field_validator("password")
    @classmethod
    def password_must_be_valid(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters.")
        return v


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


# ── Phoenix OTEL Tracing (Optional) ──────────────────────────────
def _init_phoenix_tracing() -> None:
    endpoint = os.getenv("PHOENIX_COLLECTOR_ENDPOINT", "http://localhost:6006/v1/traces")
    enable = os.getenv("ENABLE_PHOENIX_TRACING", "false").lower() in ("true", "1", "yes")
    if not enable:
        logger.debug("Phoenix OTEL tracing disabled.")
        return

    try:
        import importlib
        trace_mod = importlib.import_module("opentelemetry.trace")
        sdk_trace = importlib.import_module("opentelemetry.sdk.trace")
        exporter_mod = importlib.import_module("opentelemetry.exporter.otlp.proto.http.trace_exporter")

        otlp_exporter = exporter_mod.OTLPSpanExporter(endpoint=endpoint)
        tracer_provider = sdk_trace.TracerProvider()
        tracer_provider.add_span_processor(sdk_trace.export.SimpleSpanProcessor(otlp_exporter))
        trace_mod.set_tracer_provider(tracer_provider)

        # Instrument OpenAI
        try:
            openai_instr = importlib.import_module("openinference.instrumentation.openai")
            openai_instr.OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
        except Exception as e:
            logger.debug("OpenAI instrumentation skipped: %s", e)

        # Instrument LangChain / LangGraph
        try:
            langchain_instr = importlib.import_module("openinference.instrumentation.langchain")
            langchain_instr.LangChainInstrumentor().instrument(tracer_provider=tracer_provider)
        except Exception as e:
            logger.debug("LangChain instrumentation skipped: %s", e)

        logger.info("🔥 Phoenix OTEL Tracing active → %s", endpoint)
    except Exception as e:
        logger.warning("Phoenix OTEL initialization skipped: %s", e)


def _seed_demo_user() -> None:
    """Creates the built-in demo account (demo / demo123) if it doesn't exist."""
    if not get_user_by_username("demo"):
        hashed = _hash_password("demo123")
        create_user("demo", hashed)
        get_or_create_user_thread("demo")
        logger.info("🔑 Demo account seeded  →  username: demo  |  password: demo123")
    else:
        get_or_create_user_thread("demo")
        logger.debug("Demo account already exists.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _init_phoenix_tracing()
    logger.info("🤖 AI-Powered Dynamic Form Assistant Backend")
    logger.info("========================================")
    logger.info("Model : %s", os.getenv("OPENAI_MODEL", "gpt-4o"))
    logger.info("Port  : %s", os.getenv("PORT", "8000"))
    
    # Initialize PostgreSQL Database & Checkpointer Tables
    db_initialized = await ainit_db()
    if db_initialized:
        checkpointer = get_async_checkpointer()
        if checkpointer is not None:
            form_agent.graph = create_form_graph(checkpointer=checkpointer)
            logger.info("🐘 PostgreSQL DB & Async Checkpointer: BOUND TO AGENT & READY")
        else:
            logger.info("🐘 PostgreSQL DB: READY (Checkpointer: in-memory)")

        # Seed demo user if it doesn't exist yet
        _seed_demo_user()
    else:
        logger.warning("🐘 PostgreSQL DB: Offline (Running with in-memory fallback)")
    
    logger.info("========================================")
    yield
    logger.info("Backend stopped")


app = FastAPI(
    title="AI-Powered Dynamic Form Assistant",
    version="1.0.0",
    lifespan=lifespan,
)

allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4000,http://localhost:3000"
).split(",")

origins_list = [origin.strip() for origin in allowed_origins]
is_wildcard = "*" in origins_list

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins_list,
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# AG-UI Form Agent Registration
# -----------------------------

form_agent = LangGraphAgent(
    name="form_agent",
    description=(
        "Enterprise AI Form Assistant that understands natural language commands, "
        "recursively traverses dynamic hierarchical form metadata, validates actions, "
        "and performs real-time bidirectional synchronization with React forms."
    ),
    graph=form_graph,
)

# Expose form_agent as native AG-UI HTTP endpoint
add_langgraph_fastapi_endpoint(
    app,
    form_agent,
    path="/agents/form_agent"
)


@app.get("/health")
async def health_check():
    db_health = check_db_health()
    return {
        "status": "healthy",
        "service": "dynamic-form-assistant-backend",
        "database": db_health
    }


# ── Auth endpoints ───────────────────────────────────────────────

@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
async def register(payload: AuthRequest):
    """Creates a new user account. Returns 409 if username already taken."""
    if get_user_by_username(payload.username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken.")
    hashed = _hash_password(payload.password)
    user = create_user(payload.username, hashed)
    if not user:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable.")
    
    # Initialize canonical thread for new user
    thread_info = get_or_create_user_thread(payload.username)
    return {
        "message": "Account created.",
        "username": user["username"],
        "thread_id": thread_info.get("thread_id"),
    }


@app.post("/auth/login")
async def login(payload: AuthRequest):
    """Verifies credentials and returns a signed JWT with user thread info."""
    user = get_user_by_username(payload.username)
    if not user or not _verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )
    update_user_last_login(payload.username)
    expire = datetime.now(timezone.utc) + timedelta(hours=_JWT_EXPIRY_HOURS)
    token = jwt.encode(
        {"sub": payload.username, "exp": expire},
        _JWT_SECRET,
        algorithm=_JWT_ALGORITHM,
    )
    # Fetch canonical thread and submission info for this user
    thread_info = get_or_create_user_thread(payload.username)
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": payload.username,
        "thread_id": thread_info.get("thread_id"),
        "is_submitted": thread_info.get("is_submitted", False),
        "submission_ref": thread_info.get("submission_ref"),
        "submitted_at": thread_info.get("submitted_at"),
    }


@app.get("/auth/user-thread")
async def user_thread_endpoint(username: str):
    """
    Retrieves or establishes the single unique canonical thread for a user.
    Enforces 'One User = One Thread & One-Time Journey'.
    """
    clean_user = username.strip() if username else ""
    if not clean_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is required.")
    return get_or_create_user_thread(clean_user)


@app.get("/auth/submission-status")
async def submission_status(username: str):
    status = get_submission_status(username)
    has = bool(status and status.get("submission_ref"))
    return {
        "has_submitted": has,
        "submission_ref": status.get("submission_ref") if status else None,
        "submitted_at": status.get("submitted_at") if status else None,
    }


@app.post("/auth/mark-submitted")
async def mark_submitted(payload: dict):
    username = payload.get("username", "").strip()
    submission_ref = payload.get("submission_ref", "").strip()
    if not username or not submission_ref:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="username and submission_ref required.")
    mark_user_submitted(username, submission_ref)
    return {"ok": True}


@app.get("/chat/submission-status/{thread_id}")
async def thread_submission_status(thread_id: str):
    """Returns submission status for a specific thread_id."""
    status = get_thread_submission_status(thread_id)
    has = bool(status and status.get("submission_ref"))
    return {
        "thread_id": thread_id,
        "has_submitted": has,
        "submission_ref": status.get("submission_ref") if status else None,
        "submitted_at": status.get("submitted_at") if status else None,
        "username": status.get("username") if status else None,
    }


@app.post("/chat/mark-submitted")
async def mark_thread_submitted_endpoint(payload: dict):
    """Marks a specific thread as submitted in PostgreSQL."""
    thread_id = payload.get("thread_id", "").strip()
    submission_ref = payload.get("submission_ref", "").strip()
    username = payload.get("username", "").strip() or None
    if not thread_id or not submission_ref:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="thread_id and submission_ref required.")
    mark_thread_submitted(thread_id, submission_ref, username)
    return {"ok": True, "thread_id": thread_id, "submission_ref": submission_ref}


@app.get("/db/status")
async def get_db_status():
    """Returns the PostgreSQL connection health and status."""
    return check_db_health()


@app.get("/applications/user/{username}")
async def user_applications_endpoint(username: str):
    """
    Returns complete application history, statistics, and metadata for a user.
    """
    clean_user = username.strip() if username else ""
    if not clean_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is required.")
    return get_user_applications_summary(clean_user)


class NewApplicationRequest(BaseModel):
    username: str


@app.post("/applications/new")
async def create_new_application_endpoint(payload: NewApplicationRequest):
    """
    Creates a new separate application journey for the user, preserving all previous applications.
    """
    clean_user = payload.username.strip()
    if not clean_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is required.")
    new_app = create_new_user_thread(clean_user)
    return new_app


@app.get("/chat/sessions")
async def list_chat_sessions(username: Optional[str] = None):
    """
    Retrieves all conversation sessions / threads with metadata from PostgreSQL.
    Optionally filters by username so users only see their own sessions.
    """
    sessions = get_all_chat_sessions(username=username)
    return {
        "count": len(sessions),
        "username": username,
        "sessions": sessions
    }


@app.get("/chat/{thread_id}")
async def get_chat_messages(thread_id: str, limit: int = 100):
    """
    Retrieves stored chat messages for a specific conversation thread from PostgreSQL.
    """
    messages = get_chat_history(thread_id=thread_id, limit=limit)
    return {
        "thread_id": thread_id,
        "count": len(messages),
        "messages": messages
    }


@app.get("/chat/{thread_id}/state")
async def get_thread_state_endpoint(thread_id: str):
    """
    Retrieves the saved form field values and status for a specific thread from PostgreSQL.
    """
    state_data = get_thread_form_state(thread_id=thread_id)
    return state_data


@app.post("/chat/{thread_id}/state")
async def save_thread_state_endpoint(thread_id: str, payload: dict):
    """
    Saves/updates form field values, active tab, and journey status for a specific thread in PostgreSQL.
    """
    field_values = payload.get("field_values", {})
    selected_tab = payload.get("selected_tab", "tab_consents")
    journey_status = payload.get("journey_status", "IN_PROGRESS")
    username = payload.get("username")
    ok = save_thread_form_state(
        thread_id=thread_id,
        field_values=field_values,
        selected_tab=selected_tab,
        journey_status=journey_status,
        username=username,
    )
    return {"ok": ok, "thread_id": thread_id}


@app.post("/chat/{thread_id}/user")
async def register_thread_user(thread_id: str, payload: dict):
    """
    Associates a thread_id with a specific username in PostgreSQL.
    """
    username = payload.get("username", "").strip()
    if username:
        associate_thread_user(thread_id, username)
    return {"ok": True, "thread_id": thread_id, "username": username}


@app.delete("/chat/{thread_id}")
async def delete_chat_messages_endpoint(thread_id: str):
    """
    Clears all stored chat messages for a specific conversation thread from PostgreSQL.
    """
    deleted_count = delete_chat_history(thread_id=thread_id)
    return {
        "thread_id": thread_id,
        "deleted_count": deleted_count,
        "status": "cleared"
    }


@app.post("/chat/{thread_id}/save")
async def save_manual_chat_message(thread_id: str, payload: dict):
    """
    Manually persists a chat message to PostgreSQL.
    """
    role = payload.get("role", "user")
    content = payload.get("content", "")
    metadata = payload.get("metadata", {})
    username = payload.get("username")
    record = save_chat_message(thread_id=thread_id, role=role, content=content, metadata=metadata, username=username)
    return {
        "status": "saved" if record else "failed",
        "record": record
    }


@app.post("/chat/transcribe")
@app.post("/transcribe")
async def transcribe_audio_endpoint(request: Request):
    """
    Transcribes audio to text using OpenAI Whisper API (whisper-1).
    Supports multipart/form-data, raw audio body, and base64 JSON payload.
    """
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured on server.")

        content_type_header = request.headers.get("content-type", "")
        audio_bytes = b""
        filename = "speech.webm"
        mime_type = "audio/webm"

        if "multipart/form-data" in content_type_header:
            form = await request.form()
            uploaded_file = form.get("file") or form.get("audio")
            if uploaded_file and hasattr(uploaded_file, "read"):
                audio_bytes = await uploaded_file.read()
                filename = getattr(uploaded_file, "filename", None) or "speech.webm"
                mime_type = getattr(uploaded_file, "content_type", None) or "audio/webm"
        elif "application/json" in content_type_header:
            body = await request.json()
            b64_data = body.get("audio_base64") or body.get("audio") or ""
            if "," in b64_data:
                b64_data = b64_data.split(",", 1)[1]
            audio_bytes = base64.b64decode(b64_data)
            filename = body.get("filename") or "speech.webm"
            mime_type = body.get("mime_type") or "audio/webm"
        else:
            audio_bytes = await request.body()
            if content_type_header:
                mime_type = content_type_header.split(";")[0].strip()
                ext = "webm" if "webm" in mime_type else ("wav" if "wav" in mime_type else "mp4")
                filename = f"speech.{ext}"

        if not audio_bytes:
            raise HTTPException(status_code=400, detail="No audio data received for transcription.")

        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        # Enforce English-only speech-to-text with Whisper
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename, audio_bytes, mime_type),
            language="en",
            prompt="UAE Mortgage Application form assistant, English dictation.",
        )

        transcribed_text = transcript.text.strip() if transcript and hasattr(transcript, "text") else str(transcript).strip()
        logger.info("OpenAI Whisper transcribed %d bytes audio -> '%s'", len(audio_bytes), transcribed_text)

        return {
            "text": transcribed_text,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Whisper transcription error: %s", e)
        raise HTTPException(status_code=500, detail=f"Whisper transcription failed: {str(e)}")




@app.get("/mcp/tools")
async def get_mcp_tools():
    """
    Model Context Protocol (MCP) Tools Registry Endpoint.
    Exposes tool schemas for Form Analysis, Journey Flow, Field Mutation, Review, and Submission.
    """
    return {
        "tools": [
            {
                "name": "mcp_analyze_form_tree",
                "description": "Inspects hierarchical form tree JSON, returning tab completion rates and field statuses.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "form_tree": {"type": "object", "description": "Form tree JSON hierarchy"},
                        "field_values": {"type": "object", "description": "Current field values map"}
                    },
                    "required": ["form_tree", "field_values"]
                }
            },
            {
                "name": "mcp_get_journey_step",
                "description": "Evaluates active step across all 6 tabs and generates context-aware questions.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "form_tree": {"type": "object", "description": "Form tree JSON hierarchy"},
                        "field_values": {"type": "object", "description": "Current field values map"}
                    },
                    "required": ["form_tree", "field_values"]
                }
            },
            {
                "name": "mcp_update_form_fields",
                "description": "Validates, type-casts, computes auto-derived fields (DOB -> Age), and mutates form state.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "form_tree": {"type": "object", "description": "Form tree JSON hierarchy"},
                        "field_values": {"type": "object", "description": "Current field values map"},
                        "updates": {"type": "array", "description": "List of field update specifications"}
                    },
                    "required": ["form_tree", "field_values", "updates"]
                }
            },
            {
                "name": "mcp_generate_review_data",
                "description": "Aggregates all tabs, sections, and values for the Single-Page Review Popup.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "form_tree": {"type": "object", "description": "Form tree JSON hierarchy"},
                        "field_values": {"type": "object", "description": "Current field values map"}
                    },
                    "required": ["form_tree", "field_values"]
                }
            },
            {
                "name": "mcp_submit_application",
                "description": "Finalizes mortgage loan application and generates registration reference.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "form_tree": {"type": "object", "description": "Form tree JSON hierarchy"},
                        "field_values": {"type": "object", "description": "Current field values map"}
                    },
                    "required": ["form_tree", "field_values"]
                }
            }
        ]
    }


if __name__ == "__main__":
    import asyncio
    import selectors
    import sys
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    config = uvicorn.Config("main:app", host="0.0.0.0", port=port, reload=False)
    server = uvicorn.Server(config)

    if sys.platform == "win32":
        # psycopg3 async is incompatible with Windows ProactorEventLoop; force SelectorEventLoop
        loop = asyncio.SelectorEventLoop(selectors.SelectSelector())
        asyncio.set_event_loop(loop)
        loop.run_until_complete(server.serve())
    else:
        asyncio.run(server.serve())
