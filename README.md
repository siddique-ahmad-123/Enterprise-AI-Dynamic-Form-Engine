# 🚀 Enterprise AI Dynamic Form Engine — UAE Mortgage Loan Portal

An enterprise-grade, real-time AI dynamic form engine built using **CopilotKit + LangGraph + FastAPI + React + Tailwind CSS + A2UI**, featuring a dedicated **Application Dashboard**, multi-journey application management, bidirectional state synchronization, recursive form tree traversal, automated multi-tab progression, single-page application review, and rich generative card UI rendering.

> **Stack:** React 18 · Vite · Tailwind CSS · CopilotKit · LangGraph · FastAPI · PostgreSQL · OpenAI GPT-4o

---

## 🌟 Key Features & Capabilities

### 1. 📊 Dedicated Executive Dashboard & Multi-Application Journey
- **Post-Login Dashboard Landing**: Users land directly on an executive **Dashboard** upon login or registration.
- **Application Metrics & KPI Cards**: Live counters for *Total Applications*, *Submitted & Underwriting*, *In Progress / Drafts*, and *Pre-Approved Credit*.
- **"Start New Application"**: Prominently initiates a fresh, isolated mortgage application journey with a unique thread ID (`thread_usr_{username}_{timestamp}`), preserving all previous application history.
- **Application Journey History**:
  - Displays all submitted and draft applications with **Submission Reference ID** (with 1-click copy), **Status Badge**, **Borrower Name**, **Loan Amount (AED)**, **Product Type**, **Property Address**, and **Timestamp**.
  - **"View Application"**: Opens completed applications in locked/read-only mode with full form hydration and conversation history.
  - **"Continue Application"**: Resumes in-progress draft applications where the user left off.
  - **Live Search & Filter Tabs**: Filter by `All`, `Submitted`, or `Drafts`, with real-time text search.
- **Seamless Navigation**: An intuitive **"← Back to Dashboard"** button in the form workspace allows instant navigation back to the dashboard anytime.

---

### 2. ⚡ Automatic Tab Navigation on Mandatory Field Completion
- Automatically advances `selectedTab` to the next step when all required/mandatory fields on the active tab are completed.
- Handles dynamic conditional logic (e.g. Co-Borrower choice `isCoBorrower`: selecting **"No"** completes the tab and auto-navigates to Income Details, while **"Yes"** unveils required co-borrower fields).
- Stepper tabs render live completion badges (`✓`) and progress indicators.

---

### 3. ✨ Multi-Field AI Focus Highlighting
- Highlights **all** fields modified, set, cleared, or auto-derived in a single turn with glowing indigo borders and pulsing `✨ AI Focused` badges across text inputs, select dropdowns, option segments, sliders, and checkboxes.

---

### 4. 📋 Single-Page Application Review & Edit Modal
- Accessible via the top toolbar (`📋 Review & Edit`) or conversational AI command.
- Aggregates all collected fields across all 6 tabs into a unified, editable review view.
- Allows direct field editing with real-time state sync and final application submission.

---

### 5. 📊 A2UI Generative Card Components
- Powered by `@copilotkit/a2ui-renderer` with custom card components:
  - **Update Success Cards (`update_success`)**: Displays multi-field update lists with field names, old vs. new values, and breadcrumb hierarchy paths.
  - **Interactive Charts (`pie_chart`, `bar_chart`)**: Renders real-time interactive Recharts visualizations for income breakdown and loan parameters.
  - **Single-Page Review Stage Card (`review_summary`)**: Interactive card triggering the review modal or conversational correction.
  - **Submission Success (`submission_success`)**: Generates a structured sanction reference ID and application summary on submission.
  - **Application Locked (`already_submitted`)**: Shown when inspecting an already-submitted application.
  - **Guardrail (`guardrail`)**: Blocks off-topic or restricted information requests.
  - **Data Tables & Metric Cards**: Tabular and KPI-style summaries.

---

### 6. 🐘 PostgreSQL State Persistence & Self-Healing
- **Multi-Thread Isolation**: User sessions and application journeys are persisted in PostgreSQL (`user_threads`, `thread_form_state`, `thread_submissions`, `chat_messages`).
- **Data Recovery & Self-Healing**: Automatically reconstructs all 39+ submitted form fields from conversation cards and form state on re-login, rendering them in locked read-only state.
- **LangGraph Async Checkpointing**: Uses `AsyncPostgresSaver` to persist full agent state across conversational turns.

---

## 📋 6-Step UAE Mortgage Application Journey

1. **Step 0: Consents & Declarations (`tab_consents`)**:
   - Terms & Conditions, Fees Sheet, Key Fact Statement, Lifestyle Expenses Verification, Privacy Notice.
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
 │  Dashboard View  ←── Navigation ──→  Workspace View (useCoAgent)│
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
         └─────────────────────┘  │   Form State + Auth)  │
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
│   ├── db/                   # PostgreSQL async connection, checkpointer, and session management
│   │   └── postgres.py       # DB pool, user management, and application history APIs
│   ├── main.py               # FastAPI entrypoint + AG-UI agent registration + Application routes
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
│   │   ├── a2ui/             # A2UI catalog & custom card component definitions
│   │   ├── components/
│   │   │   ├── Dashboard.tsx # Executive Application Dashboard & History component
│   │   │   ├── auth/         # LoginScreen, AlreadySubmittedModal
│   │   │   ├── chat/         # ChatCardRenderer, CustomRenderMessage, VoiceInput, ChatHistoryModal
│   │   │   ├── form/         # Recursive dynamic form renderers & ReviewModal
│   │   │   ├── layout/       # Header branding & banner toolbar
│   │   │   └── ui/           # QuickActions & UI primitives
│   │   ├── hooks/            # useFormState (state hydration & auto-tab) & useChatSession
│   │   ├── state/            # Default form tree definition
│   │   ├── types/            # TypeScript interfaces
│   │   ├── App.tsx           # Shell routing: Dashboard vs. Application Workspace
│   │   └── main.tsx
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml        # Multi-service orchestration (backend, runtime, frontend, postgres, pgadmin)
└── README.md
```

---

## 🔌 API Endpoints Summary

### Application & Journey Management
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/applications/user/{username}` | Retrieves all application journeys (submitted & drafts) with metrics for Dashboard |
| `POST` | `/applications/new` | Creates and registers a new distinct application journey (`thread_id`) |
| `GET` | `/chat/{thread_id}/state` | Fetches full saved form field values, selected tab, and journey status |
| `POST` | `/chat/{thread_id}/state` | Updates form field values and status for a specific thread |
| `GET` | `/chat/submission-status/{thread_id}` | Checks if a specific thread has already been submitted |
| `POST` | `/chat/mark-submitted` | Records submission reference and timestamps for a thread |

### Authentication & Sessions
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/login` | Authenticates user credentials and issues JWT token |
| `POST` | `/auth/register` | Registers a new account and initializes application thread |
| `GET` | `/auth/user-thread` | Returns canonical thread info for a user |
| `GET` | `/chat/sessions` | Lists conversation history sessions for a user |
| `GET` | `/chat/{thread_id}` | Retrieves stored chat messages for a thread |
| `DELETE` | `/chat/{thread_id}` | Clears conversation history for a thread |
| `GET` | `/health` / `/db/status` | Health check for FastAPI and PostgreSQL |

---

## 🛠️ Environment Configuration

Create a `.env` file in the `backend/` directory:

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

# JWT Authentication
JWT_SECRET=enterprise-secret-key-change-in-production
JWT_EXPIRY_HOURS=8

# Optional: Arize Phoenix observability
ENABLE_PHOENIX=false
PHOENIX_COLLECTOR_ENDPOINT=https://your-phoenix-endpoint/v1/traces
```

---

## 🚦 Getting Started

### Option 1: Run with Docker Compose (Recommended)

```bash
# 1. Ensure backend/.env has your OPENAI_API_KEY
# 2. Build and start all services:
docker compose up --build -d
```

| Service | URL | Notes |
| :--- | :--- | :--- |
| **React Frontend** | `http://localhost:5173` | Dedicated Dashboard + Form Workspace |
| **CopilotKit Runtime** | `http://localhost:4000/copilotkit` | AG-UI Node runtime bridge |
| **FastAPI Backend** | `http://localhost:8000/docs` | OpenAPI documentation & endpoints |
| **pgAdmin** | `http://localhost:5055` | `admin@admin.com` / `admin` |
| **PostgreSQL** | `localhost:5433` | Database: `myapp`, User: `admin` |

> **Default Demo Account:**
> - **Username:** `demo`
> - **Password:** `demo123`

---

### Option 2: Run Services Locally

#### 1. Start PostgreSQL
```bash
docker compose up postgres-db -d
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

## 🤖 Example Conversational AI Prompts

Try entering these commands in the AI Assistant sidebar:

| Intent | Example AI Prompt |
| :--- | :--- |
| **Consent Approval** | `"Yes, I agree to all declarations and terms"` |
| **Multi-Field Update** | `"My name is Ali Ahmad, DOB 2003-01-01, mobile +971501234567, email ali@example.com"` |
| **Unstructured Address** | `"Marina Gate Tower 2, Apt 1804, Dubai Marina, Dubai, UAE"` |
| **Co-Borrower Choice** | `"No co-borrower"` *or* `"Add co-borrower Usman, mobile +971559876543, EIDA 784-1994-1234567-1"` |
| **Income Details** | `"I am Salaried at TCS Consultancy with a monthly salary of 70,000 AED"` |
| **Loan Configuration** | `"Home Purchase Loan, loan amount 2,500,000 AED, tenure 240 months, rate 4.5%"` |
| **Field Query** | `"What is my currently filled monthly salary?"` |
| **Clear a Field** | `"Clear my email address"` |
| **Pie Chart** | `"Show a pie chart breakdown of my loan parameters"` |
| **Missing Fields** | `"Which required fields are still missing?"` |
| **Form Summary** | `"Summarize my mortgage application"` |
| **Single-Page Review** | `"Review application"` |
| **Final Submission** | `"Submit application"` |

---

## 📜 License

Distributed under the MIT License.
