"""
AI-Powered Dynamic Form Assistant — FastAPI Backend

LangGraph agent backend, served as a native AG-UI HTTP endpoint.
The Node.js CopilotRuntime connects here via HttpAgent using the AG-UI protocol.
"""

import os
import logging
import warnings
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

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
)

warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
)

logger = logging.getLogger(__name__)

load_dotenv()

# ── Arize Phoenix / OpenTelemetry Observability ─────────────────
enable_phoenix = os.getenv("ENABLE_PHOENIX", "true").lower() == "true"
if enable_phoenix:
    try:
        import importlib
        endpoint = os.getenv(
            "PHOENIX_COLLECTOR_ENDPOINT",
            "https://ainsg.newgensoftware.net/phoenix/v1/traces"
        )

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("========================================")
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


@app.get("/db/status")
async def get_db_status():
    """Returns the PostgreSQL connection health and status."""
    return check_db_health()


@app.get("/chat/sessions")
async def list_chat_sessions():
    """
    Retrieves all conversation sessions / threads with metadata from PostgreSQL.
    """
    sessions = get_all_chat_sessions()
    return {
        "count": len(sessions),
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
    record = save_chat_message(thread_id=thread_id, role=role, content=content, metadata=metadata)
    return {
        "status": "saved" if record else "failed",
        "record": record
    }



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
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )
