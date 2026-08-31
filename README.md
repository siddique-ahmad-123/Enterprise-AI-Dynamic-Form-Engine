# 🚀 Enterprise AI Dynamic Form Engine — Newgen Loan Portal

An enterprise-grade, real-time AI dynamic form engine built using **CopilotKit + LangGraph + FastAPI + React + Tailwind CSS + A2UI**, featuring bidirectional state synchronization, recursive form tree traversal, automated multi-tab journey progression, single-page application review, and rich generative card UI rendering.

> **Stack:** React 18 · Vite · Tailwind CSS · CopilotKit · LangGraph · FastAPI · PostgreSQL · OpenAI GPT-4o

---

## 🌟 Key Features & Capabilities

- **⚡ Automatic Tab Navigation on Mandatory Field Completion**:
  - Automatically advances `selectedTab` to the next step when all required/mandatory fields on the active tab are filled.
  - Handles conditional visibility dynamically (e.g. Co-Borrower tab choice `isCoBorrower`: selecting **"No"** completes the tab and auto-moves to Income Details, while **"Yes"** unveils required co-borrower fields).
  - Stepper tabs render live completion badges (`✓`) and progress indicators.

- **✨ Multi-Field AI Focus Highlighting**:
  - Highlights **all** fields modified, set, cleared, or auto-derived in a single turn with glowing indigo borders and pulsing `✨ AI Focused` badges across text inputs, select dropdowns, option segments, sliders, and checkboxes.

- **📋 Single-Page Application Review & Edit Modal**:
  - Accessible via top toolbar (`📋 Single-Page Review & Edit`) or AI chat command.
  - Aggregates all collected fields across all 6 tabs into a unified, editable view.
  - Allows full direct editing with real-time state sync and one-click application submission.

- **📊 A2UI Generative Card Components**:
  - Powered by `@copilotkit/a2ui-renderer` with custom card components:
    - **Update Success Cards (`update_success`)**: Displays multi-field update lists with target field names, old vs. new values, and breadcrumb hierarchy paths.
    - **Interactive Charts (`pie_chart`, `bar_chart`)**: Renders real-time interactive Recharts visualizations for income breakdown and loan parameters.
    - **Single-Page Review Stage Card (`review_summary`)**: Interactive card triggering the review modal or conversational correction.
    - **Submission Success (`submission_success`)**: Generates a structured sanction reference ID and application summary on first submit.
    - **Application Locked (`already_submitted`)**: Shown when a user attempts to re-submit an already-finalized application.
    - **Guardrail (`guardrail`)**: Blocks off-topic or restricted information requests.
    - **Data Tables & Metric Cards**: Tabular and KPI-style summaries.

- **🎨 Enterprise Newgen UI System**:
  - **Horizontal Stepper Tabs Bar**: Numbered and checkmark step headers (`Consents`, `Personal Details – Borrower`, `Personal Details – Co-Borrower`, `Income Details`, `Product & Loan Details`, `Decision & Sanction`).
  - **Uniform 3-Column Grid Layout**: Form fields arranged in an enterprise 3-column grid (`grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5`).
  - **Light Ice-Blue Banners (`#edf4fc`)**: Clean section container styling matching Newgen Enterprise Portal standards.

- **🌳 Recursive Dynamic Form Tree Traversal**:
  - Infinite hierarchy depth traversal (`Form` ➔ `Tab` ➔ `Section` ➔ `Panel` ➔ `Group` ➔ `Container` ➔ `Field` / `Action Button` / `Upload` / `Slider` / `Segment`).

- **🔒 Read-Only Business Rule Protection**:
  - Automatically protects read-only fields (`readonly = true`), preventing unauthorized modification and returning validation notices.

- **🐘 PostgreSQL Persistent Chat History**:
  - All conversation messages and card metadata are persisted per thread in PostgreSQL.
  - Previous sessions can be restored via the **Chat History** modal, with card data re-embedded from stored metadata.

- **🔁 LangGraph Checkpointing**:
  - Uses a PostgreSQL-backed `AsyncPostgresSaver` (falls back to in-memory `MemorySaver`) to persist the full agent state across turns within a thread.

---

## 📋 6-Step Mortgage Application Journey

1. **Step 0: Consents & Declarations (`tab_consents`)**:
   - Terms & Conditions, Fees Sheet, Key Fact Statement, Lifestyle Verification, Privacy Notice.
2. **Step 1: Personal Details – Borrower (`tab_personal_borrower`)**:
   - Full Name, DOB (auto-calculates Age), EIDA, Passport, Mobile, Email, Residential Address, EFR Biometric Verification.
3. **Step 2: Personal Details – Co-Borrower (`tab_personal_coborrower`)**:
   - Co-Borrower selection segment (Yes/No toggle) with conditional EIDA, Mobile, Name fields.
4. **Step 3: Income Details – Borrower (`tab_income_borrower`)**:
   - Income Type (Salaried / Self Employed), Employer Name, Employed From, AECB / Salary Certificate upload, Monthly Salary.
5. **Step 4: Product & Loan Details (`tab_product_loan`)**:
   - Loan Type, Purpose, ROI Type, Loan Amount & Tenure Sliders, Property Valuation & Down Payment.
6. **Step 5: Decision & Sanction (`tab_decision`)**:
   - Underwriting pre-approval sanction status, notes, admin fees, final application submission.

---

## 🏗️ Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────────┐
 │        React Frontend (Vite + Tailwind CSS + CopilotKit + A2UI) │
 │   useCoAgent ←──── bidirectional state sync ────→ CopilotKit   │
 └────────────────────────────────┬────────────────────────────────┘
                                  │ useCoAgent State Sync
                                  ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │      Node.js CopilotRuntime (Express Server @ 4000)             │
 └────────────────────────────────┬────────────────────────────────┘
                                  │ AG-UI Protocol (HttpAgent)
                                  ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │      Python FastAPI Backend (LangGraph Agent Workflow @ 8000)   │
 │                                                                  │
 │   receive_request → understand_intent → traverse_tree           │
 │       → locate_node → validate_action → update_shared_state     │
 │       → generate_response                                        │
 └────────────────────────────────┬────────────────────────────────┘
                       ┌──────────┴──────────┐
                       ▼                     ▼
         ┌─────────────────────┐  ┌──────────────────────┐
         │  OpenAI GPT-4o LLM  │  │  PostgreSQL Database  │
         │  (Intent + NLP)     │  │  (Checkpointer +      │
         └─────────────────────┘  │   Chat History)       │
                                  └──────────────────────┘
```

---

## 📁 Repository Structure

```
copilotkit_use_case/
├── backend/                  # Python FastAPI & LangGraph AI Agent
│   ├── graph/                # LangGraph Workflow Nodes & State Graph
│   │   ├── nodes.py          # Node executors: receive, intent, traverse, validate, update, respond
│   │   └── workflow.py       # Compiled StateGraph pipeline
│   ├── mcp/                  # Model Context Protocol Tools Layer
│   │   └── tools.py          # MCP tool executors & journey manager
│   ├── models/               # Pydantic form node & intent schemas
│   ├── services/             # Tree traversal, field resolution, auto-calculations
│   ├── state/                # FormAgentState definition (extends CopilotKitState)
│   ├── db/                   # PostgreSQL async connection & checkpointer
│   ├── main.py               # FastAPI entrypoint + AG-UI agent registration
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile
│
├── copilot-runtime/          # Node.js CopilotKit Runtime Server
│   ├── src/index.ts          # Express server & AG-UI HttpAgent router
│   ├── package.json
│   └── Dockerfile
│
├── frontend/                 # React Frontend Application
│   ├── src/
│   │   ├── a2ui/             # A2UI catalog & card component definitions
│   │   ├── components/
│   │   │   ├── chat/         # ChatCardRenderer, CustomRenderMessage, VoiceInput, etc.
│   │   │   ├── form/         # Recursive form renderers & ReviewModal
│   │   │   └── ui/           # QuickActions & shell UI
│   │   ├── hooks/            # useFormState (auto-tab progression) & useChatSession
│   │   ├── state/            # Default form tree definition
│   │   ├── types/            # TypeScript interfaces
│   │   ├── App.tsx           # Main shell: CopilotKit + CopilotSidebar + MainContent
│   │   └── main.tsx
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml        # Multi-service orchestration (backend, runtime, frontend, postgres, pgadmin)
└── README.md
```

---

## 🛠️ Environment Configuration

Create a `.env` file in the `backend/` directory (see `.env.example`):

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o
PORT=8000
HOST=0.0.0.0

# PostgreSQL (matches docker-compose defaults)
DATABASE_URL=postgresql://admin:admin@localhost:5433/myapp
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DB=myapp
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin

# Optional: Arize Phoenix observability
ENABLE_PHOENIX=false
PHOENIX_COLLECTOR_ENDPOINT=https://your-phoenix-endpoint/v1/traces
```

---

## 🚦 Getting Started

### Option 1: Run with Docker Compose (Recommended)

```bash
# Copy and fill in your OpenAI key first
cp backend/.env.example backend/.env
# Edit backend/.env and set OPENAI_API_KEY

docker-compose up --build
```

| Service | URL |
| :--- | :--- |
| React Frontend | `http://localhost:5173` |
| CopilotKit Runtime | `http://localhost:4000/copilotkit` |
| FastAPI Backend | `http://localhost:8000/health` |
| pgAdmin | `http://localhost:5055` (admin@admin.com / admin) |
| PostgreSQL | `localhost:5433` |

---

### Option 2: Run Services Locally

#### 1. Start PostgreSQL
Start the database only via Docker Compose (or use an existing instance):
```bash
docker-compose up postgres-db -d
```

#### 2. Start the Backend (FastAPI + LangGraph)
```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

pip install -r requirements.txt
python main.py
# Running at http://localhost:8000
```

#### 3. Start the CopilotRuntime (Node.js)
```bash
cd copilot-runtime
npm install
npm run dev
# Running at http://localhost:4000
```

#### 4. Start the Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
# Running at http://localhost:5173
```

---

## 🤖 Example AI Prompts

Try entering these commands in the AI Assistant chat sidebar:

| Intent | Example AI Prompt |
| :--- | :--- |
| **Consent Approval** | `"Yes, I agree to all terms and declarations"` |
| **Multi-Field Update** | `"Set my name to John Doe, DOB 1995-05-15, mobile +971501234567, email john@example.com"` |
| **Unstructured Address** | `"Flat 402, Sunshine Apartments, MG Road, Mumbai 400058, India"` |
| **Co-Borrower Choice** | `"No co-borrower"` *or* `"Add co-borrower Sara Ali, mobile +971559876543"` |
| **Income Details** | `"I am Salaried at Emaar Properties, monthly salary 45000 AED"` |
| **Loan Configuration** | `"Home Purchase Loan, amount 3,000,000 AED, tenure 240 months, rate 4.5%"` |
| **Field Query** | `"What is my current mobile number?"` |
| **Clear a Field** | `"Clear the email field"` |
| **Pie Chart** | `"Show a pie chart summary of my form completion"` |
| **Missing Fields** | `"Which fields are still empty?"` |
| **Form Summary** | `"Summarize my application"` |
| **Single-Page Review** | `"Review application"` *or click the toolbar button* |
| **Final Submission** | `"Submit application"` |

---

## 🐛 Known Issues Fixed

| # | Issue | Fix |
| :--- | :--- | :--- |
| 1 | **First submission always showed "Application Already Submitted"** | `generate_response_node` was reading `state.get("journeyStatus")` which LangGraph had already merged to `"SUBMITTED"` (from `update_shared_state_node` in the same turn). Fixed by capturing `previous_journey_status` before the state update and passing it through `pendingUpdates`. |
| 2 | **`already_submitted` and `guardrail` cards never rendered** | Both card-type checks in `ChatCardRenderer.tsx` were placed after the unconditional `return` for the help/welcome card, making them dead code. Fixed by moving them before the default fallback `return`. |

---

## 📜 License

Distributed under the MIT License.
