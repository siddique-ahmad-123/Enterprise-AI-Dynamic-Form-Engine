# 🚀 Enterprise AI Dynamic Form Engine — Newgen Loan Portal

An enterprise-grade, real-time AI dynamic form engine built using **CopilotKit + LangGraph + FastAPI + React + Tailwind CSS + A2UI**, featuring bidirectional state synchronization, recursive form tree traversal, automated multi-tab journey progression, single-page application review, and rich generative card UI rendering.

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
    - **Single-Page Review Stage Card (`review_summary`)**: Interactive card triggering the review modal or step review.
    - **Data Tables, Metric Cards & Sanction Badges (`submission_success`)**: Generates structured sanction reference IDs and application summaries.

- **🎨 Enterprise Newgen UI System**:
  - **Horizontal Stepper Tabs Bar**: Numbered and checkmark step headers (`Consents`, `Personal Details – Borrower`, `Personal Details – Co-Borrower`, `Income Details`, `Product & Loan Details`, `Decision & Sanction`).
  - **Uniform 3-Column Grid Layout**: Form fields arranged in an enterprise 3-column grid (`grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5`).
  - **Light Ice-Blue Banners (`#edf4fc`)**: Clean section container styling matching Newgen Enterprise Portal standards.

- **🌳 Recursive Dynamic Form Tree Traversal**:
  - Infinite hierarchy depth traversal (`Form` ➔ `Tab` ➔ `Section` ➔ `Panel` ➔ `Group` ➔ `Container` ➔ `Field` / `Action Button` / `Upload` / `Slider` / `Segment`).

- **🔒 Read-Only Business Rule Protection**:
  - Automatically protects read-only fields (`readonly = true`), preventing unauthorized modification and returning validation notices.

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
 └────────────────────────────────┬────────────────────────────────┘
                                  │ useCoAgent State Sync
                                  ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │      Node.js CopilotRuntime (Express Server @ 4000)             │
 └────────────────────────────────┬────────────────────────────────┘
                                  │ AG-UI Protocol (HttpAgent)
                                  ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │      Python FastAPI Backend (LangGraph Agent Workflow @ 8000)    │
 └────────────────────────────────┬────────────────────────────────┘
                                  │ MCP Tools Layer (services/)
                                  ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │            OpenAI LLM / LangChain Model Execution               │
 └─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
copilotkit_use_case/
├── backend/                  # Python FastAPI & LangGraph AI Agent
│   ├── graph/                # LangGraph Workflow Nodes & State Graph
│   │   ├── nodes.py          # Node Executors (receive, intent, update, response)
│   │   └── workflow.py       # Compiled StateGraph Pipeline
│   ├── mcp/                  # Model Context Protocol Tools Layer
│   │   └── tools.py          # MCP Tool Executors & Journey Manager
│   ├── models/               # Pydantic Form Node & Intent Schemas
│   ├── services/             # Tree Traversal, Field Resolution, Auto-Calculations
│   ├── state/                # Form Agent State Definition
│   ├── main.py               # FastAPI Entrypoint Server
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
│   │   ├── a2ui/             # A2UI Catalog & Card Component Renderers
│   │   │   ├── catalog.ts
│   │   │   ├── definitions.ts
│   │   │   └── renderers.tsx
│   │   ├── components/
│   │   │   ├── chat/         # Custom Render Messages & Chat Cards
│   │   │   │   ├── ChatCardRenderer.tsx
│   │   │   │   └── CustomRenderMessage.tsx
│   │   │   ├── form/         # Dynamic Recursive Form Renderers
│   │   │   │   ├── FormRenderer.tsx
│   │   │   │   ├── TabRenderer.tsx
│   │   │   │   ├── SectionRenderer.tsx
│   │   │   │   ├── ContainerRenderer.tsx
│   │   │   │   ├── FieldRenderer.tsx
│   │   │   │   └── ReviewModal.tsx
│   │   │   └── ui/           # Quick Actions & Shell UI
│   │   ├── hooks/            # useFormState & Auto-Tab Progression
│   │   ├── state/            # Default Form Tree Definition
│   │   ├── types/            # TypeScript Interface Definitions
│   │   ├── App.tsx           # Main Application Shell & Chatbot Sidebar
│   │   ├── index.css         # Custom Theme & Styling Rules
│   │   └── main.tsx          # React Root Entrypoint
│   ├── package.json          # Frontend Dependencies
│   └── Dockerfile            # Frontend Containerization
│
├── docker-compose.yml        # Docker Multi-Service Orchestration
└── README.md                 # Project Documentation
```

---

## 🛠️ Environment Configuration

Create a `.env` file in the `backend/` directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=8000
HOST=0.0.0.0
# Optional Arize Phoenix Observability
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
```

---

## 🚦 Getting Started

### Option 1: Run with Docker Compose (Recommended)

```bash
docker-compose up --build
```

- **React Frontend**: `http://localhost:5173`
- **Copilot Runtime**: `http://localhost:4000/copilotkit`
- **FastAPI Python Backend**: `http://localhost:8000/health`

---

### Option 2: Run Services Locally

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
# Running at http://localhost:8000
```

#### 2. Start the CopilotRuntime (Node.js)
```bash
cd copilot-runtime
npm install
npm run dev
# Running at http://localhost:4000
```

#### 3. Start the Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
# Running at http://localhost:5173
```

---

## 🤖 Example AI Prompts

Try entering these commands in the AI Assistant chat window:

| Intent | Example AI Prompt |
| :--- | :--- |
| **Consent Approval** | `"Yes, I agree to all terms and declarations"` |
| **Multi-Field Update** | `"Set my name to John Doe, DOB 1995-05-15, mobile +971501234567, email john@example.com"` |
| **Co-Borrower Choice** | `"No co-borrower"` *or* `"Add co-borrower named Sara Ali with mobile +971559876543"` |
| **Income Updates** | `"I am Salaried at Emaar Properties with monthly salary 45000 AED"` |
| **Loan Configuration** | `"Home Purchase Loan, amount 3,000,000 AED, tenure 240 months"` |
| **Single-Page Review** | `"Review application"` *or click top toolbar button* |
| **Final Submission** | `"Submit application"` |

---

## 📜 License

Distributed under the MIT License.
