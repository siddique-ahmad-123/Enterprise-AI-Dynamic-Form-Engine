import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { HttpAgent } from "@ag-ui/client";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNodeExpressEndpoint,
} from "@copilotkit/runtime";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || process.env.COPILOT_RUNTIME_PORT) || 4000;
const PYTHON_ENDPOINT =
  process.env.PYTHON_COPILOT_URL || "http://localhost:8000/copilotkit";

// Enable CORS for frontend requests
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "copilot-runtime-server",
    pythonEndpoint: PYTHON_ENDPOINT,
  });
});

// ExperimentalEmptyAdapter — LLM calls are handled entirely by the Python backend
const serviceAdapter = new ExperimentalEmptyAdapter();

// Base URL for native AG-UI agents
const PYTHON_BASE_URL = PYTHON_ENDPOINT.replace(/\/copilotkit\/?$/, "");

// Register form_agent as an AG-UI HttpAgent routing requests to Python FastAPI backend
const runtime = new CopilotRuntime({
  agents: {
    form_agent: new HttpAgent({
      url: `${PYTHON_BASE_URL}/agents/form_agent`,
      description:
        "Enterprise AI Form Assistant that understands natural language commands, recursively traverses form metadata, and updates form state.",
    }),
  },
});

// Register CopilotKit Node Express endpoint handler
const handler = copilotRuntimeNodeExpressEndpoint({
  endpoint: "/copilotkit",
  runtime,
  serviceAdapter,
});

app.use(handler);

app.listen(PORT, () => {
  console.log("========================================");
  console.log("🤖 CopilotKit Runtime Server");
  console.log("========================================");
  console.log(`Port           : ${PORT}`);
  console.log(`Endpoint       : http://localhost:${PORT}/copilotkit`);
  console.log(`Python Agent   : ${PYTHON_BASE_URL}/agents/form_agent`);
  console.log("========================================");
});
