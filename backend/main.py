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
from graph.workflow import form_graph

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
    return {
        "status": "healthy",
        "service": "dynamic-form-assistant-backend"
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
