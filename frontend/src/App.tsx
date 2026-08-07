import React, { useState } from "react";
import "@copilotkit/react-ui/styles.css";
import { CopilotKit, useCopilotChat } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { Bot, X, Sparkles } from "lucide-react";

import { FormRenderer } from "./components/form/FormRenderer";
import { QuickActions } from "./components/ui/QuickActions";
import { useFormState } from "./hooks/useFormState";

const COPILOT_INSTRUCTIONS = `
You are the AI Dynamic Form Assistant — an enterprise form engine assistant for Newgen Loan Applications.

Capabilities:
1. Understand natural language requests to update, query, or clear fields in a dynamic form hierarchy.
2. Traversal: Recursively traverse form nodes (Form -> Tab -> Section -> Panel -> Group -> Container -> Field).
3. Semantic matching: Match labels (e.g. "Customer Name", "Channel", "Branch", "case priority") to exact node_ids.
4. Readonly Rules: IF A FIELD HAS readonly=true (e.g. Account Balance), DO NOT MODIFY IT. Respond: "[Field Name] is read-only and cannot be modified."
5. Navigation: Switch tabs automatically when user asks to navigate to a tab (e.g. Check Eligibility, Customer Details, Financial Info, Loan Info, Decision).
6. Validation & Reporting: Summarize form values, report missing mandatory fields, and explain field usages.

Always perform two-way synchronization and keep responses helpful, clear, and structured in Markdown.
`;

const RUNTIME_URL =
  import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "http://localhost:4000/copilotkit";

interface MainContentProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

function MainContent({ isSidebarOpen, onToggleSidebar }: MainContentProps) {
  const {
    state,
    updateFieldValue,
    setSelectedTab,
    running,
  } = useFormState();

  const { appendMessage } = useCopilotChat();

  const handleSelectPrompt = (promptText: string) => {
    if (!isSidebarOpen) {
      onToggleSidebar();
    }
    appendMessage({
      role: "user",
      content: promptText,
    } as any);
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-900 pb-16 font-sans antialiased">
      {/* Main Full-Width Form View */}
      <main className="w-full px-4 md:px-8 py-6">
        {/* Dynamic Recursive Form Component */}
        <FormRenderer
          formTree={state.formTree}
          fieldValues={state.fieldValues}
          selectedTab={state.selectedTab}
          onTabChange={setSelectedTab}
          onFieldChange={updateFieldValue}
          selectedNode={state.selectedNode}
          lastAction={state.lastAction}
          isProcessing={running}
        />

        {/* Quick Test Action Prompts */}
        <div className="mt-8 max-w-7xl mx-auto">
          <QuickActions onSelectPrompt={handleSelectPrompt} />
        </div>
      </main>

      {/* Floating Chatbot Action Trigger (FAB) */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {!isSidebarOpen && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1e295d] text-white text-xs font-semibold shadow-lg animate-bounce border border-indigo-300/30">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Ask AI Assistant</span>
          </div>
        )}
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle AI Chatbot"
          className={`flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 ${
            isSidebarOpen
              ? "bg-slate-800 text-white hover:bg-slate-900 ring-4 ring-slate-400/20"
              : "bg-[#1e295d] text-white hover:bg-[#161f48] ring-4 ring-indigo-500/30"
          }`}
        >
          {isSidebarOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <div className="relative">
              <Bot className="w-7 h-7" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <CopilotKit runtimeUrl={RUNTIME_URL} agent="form_agent">
      <CopilotSidebar
        instructions={COPILOT_INSTRUCTIONS}
        labels={{
          title: "🤖 Form AI Assistant",
          placeholder: "Type: 'Set Customer Name to John', 'Which fields are empty?'...",
          stopGenerating: "Stop",
          regenerateResponse: "Regenerate",
        }}
        defaultOpen={false}
        clickOutsideToClose={false}
      >
        <MainContent
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />
      </CopilotSidebar>
    </CopilotKit>
  );
}
