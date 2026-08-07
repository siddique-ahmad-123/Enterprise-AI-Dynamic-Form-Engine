# 🚀 Enterprise AI Dynamic Form Engine — Newgen Loan Portal

An enterprise-grade, real-time AI dynamic form application built using **CopilotKit + LangGraph + FastAPI + React + Tailwind CSS**, featuring bidirectional state synchronization, recursive form tree traversal, and natural language form manipulation.

---

## 🌟 Features & Highlights

- **⚡ Bidirectional Real-Time State Synchronization**: User UI modifications immediately update shared state for the AI agent, while natural language AI commands instantaneously render live on the screen.
- **🎨 Enterprise Loan Portal Design**: Styled matching Newgen Enterprise Loan Portal design guidelines:
  - **Numbered & Checkmark Stepper Tab Header**: Horizontal stepper tabs (`Basic Details`, `CKYC Data Pull`, `Nominee Details`, `Document`, `Account & Services`, `Checklist`, `Due Diligence`) with dark navy checkmark circles (`✓`), step number badges, and active step underline indicators.
  - **Uniform 3-Column Grid**: Form fields align in a 3-column grid per section (`grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5`).
  - **Light Ice-Blue Section Banners (`#edf4fc`)**: Styled section headers with navy title text and clean container cards.
  - **Soft Light Form Inputs (`#f1f3f6`)**: Text inputs, dropdowns, and textareas styled with soft grey backgrounds, rounded corners (`rounded-lg`), red mandatory asterisks `*`, and chevron selectors.
  - **Floating AI Assistant Trigger (FAB)**: On-demand floating chatbot button in the bottom-right corner.
- **🌳 Recursive Dynamic Form Tree Traversal**: Supports infinite nesting depth (`Form` ➔ `Tab` ➔ `Section` ➔ `Panel` ➔ `Group` ➔ `Container` ➔ `Field` / `Action Button`).
- **🧠 Semantic Field Matching & Resolution**: Automatically resolves natural language references (e.g., `"Customer Name"`, `"client name"`, `"applicant name"`, `"channel"`) to exact target form node IDs.
- **🔒 Strict Read-Only Rule Enforcement**: Automatically protects read-only fields (`readonly = true`), preventing accidental AI modification and returning clear notification responses.
- **📊 Form Completion & Progress Analytics**: Displays real-time progress bar percentage tracking filled vs. total required fields.
- **🔍 Observability & OpenTelemetry**: OpenTelemetry tracing integrated with Arize Phoenix for monitoring agent node executions and LLM calls.

---

## 🏗️ Architecture Overview

```
 ┌─────────────────────────────────────────────────────────┐
 │       React Frontend (Vite + Tailwind CSS + Lucide)     │
 └────────────────────────────┬────────────────────────────┘
                              │ useCoAgent State Sync
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │     Node.js CopilotRuntime (Express @ 4000)             │
 └────────────────────────────┬────────────────────────────┘
                              │ AG-UI Protocol (HttpAgent)
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │     Python FastAPI Backend (LangGraph Agent @ 8000)      │
 └────────────────────────────┬────────────────────────────┘
                              │ LLM Workflow Traversal
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │            OpenAI GPT-4o / LangChain Model              │
 └─────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
copilotkit_use_case/
├── backend/                  # Python FastAPI & LangGraph AI Agent
│   ├── agent/                # LangGraph State Graph & Node Executors
│   ├── models/               # Pydantic Form Node & Action Schemas
│   ├── services/             # Recursive Tree Traversal & Field Resolution
│   ├── state/                # Form Agent State Definition
│   ├── main.py               # FastAPI Application Entrypoint
│   ├── requirements.txt      # Python Dependencies
│   └── Dockerfile            # Backend Containerization
│
├── copilot-runtime/          # Node.js CopilotKit Runtime Server
│   ├── src/index.ts          # Express Server & AG-UI Router
│   ├── package.json          # Node Dependencies
│   └── Dockerfile            # Runtime Containerization
│
├── frontend/                 # React Frontend Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── form/         # Dynamic Recursive Form Renderers
│   │   │   │   ├── FormRenderer.tsx
│   │   │   │   ├── TabRenderer.tsx
│   │   │   │   ├── SectionRenderer.tsx
│   │   │   │   ├── ContainerRenderer.tsx
│   │   │   │   └── FieldRenderer.tsx
│   │   │   ├── layout/       # Navigation & Header Components
│   │   │   └── ui/           # Quick Test Action Prompt Buttons
│   │   ├── hooks/            # useFormState & Copilot CoAgent Integration
│   │   ├── state/            # Default Enterprise Form Tree Structure
│   │   ├── types/            # TypeScript Interface Definitions
│   │   ├── App.tsx           # Main Application Shell & Chatbot Sidebar
│   │   └── main.tsx          # React Root Entrypoint
│   ├── tailwind.config.js    # Tailwind CSS Configuration
│   ├── postcss.config.js     # PostCSS Directives
│   ├── package.json          # Frontend Dependencies
│   └── Dockerfile            # Frontend Containerization
│
├── docker-compose.yml        # Docker Multi-Service Orchestration
└── .gitignore                # Git Exclusions (node_modules, .env, dist)
```

---

## 🛠️ Environment Configuration

Create a `.env` file in the `backend/` directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=8000
HOST=0.0.0.0
# Phoenix Observability (Optional)
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
```

---

## 🚦 Getting Started

### Option 1: Run Services Locally

#### 1. Start the Backend (FastAPI + LangGraph)
```bash
cd backend
python -m venv venv

# Windows PowerShell:
venv\Scripts\activate
# Linux / macOS:
source venv/bin/activate

pip install -r requirements.txt
python main.py
# Server runs at http://localhost:8000
```

#### 2. Start the CopilotRuntime (Node.js)
```bash
cd copilot-runtime
npm install
npm run dev
# Runtime runs at http://localhost:4000
```

#### 3. Start the Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
# Web app runs at http://localhost:5173
```

---

### Option 2: Run with Docker Compose

```bash
docker-compose up --build
```

- **Frontend Application**: `http://localhost:5173`
- **Copilot Runtime**: `http://localhost:4000/copilotkit`
- **Python Backend API**: `http://localhost:8000/health`

---

## 🤖 Example AI Assistant Prompts

Try entering these commands in the floating AI Assistant chat:

| Intent | Example AI Prompt |
| :--- | :--- |
| **Field Update** | `"Set Customer Name to Siddique and Income Type to Salaried"` |
| **Tab Navigation** | `"Navigate to Account & Services tab"` |
| **Form Query** | `"Which required fields are currently empty?"` |
| **Read-Only Test** | `"Change Minimum Account Balance to $50,000"` *(Will report read-only protection)* |
| **Form Summary** | `"Summarize all entered details for this applicant"` |

---

## 📜 License

Distributed under the MIT License.
