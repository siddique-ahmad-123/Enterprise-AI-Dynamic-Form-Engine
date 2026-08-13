import React from "react";
import "@copilotkit/react-ui/styles.css";
import { CopilotKit, useCopilotChat } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";

import { FormRenderer } from "./components/form/FormRenderer";
import { QuickActions } from "./components/ui/QuickActions";
import { CustomRenderMessage } from "./components/chat/CustomRenderMessage";
import { useFormState } from "./hooks/useFormState";
import { myCatalog } from "./a2ui/catalog";

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

function MainContent() {
  const {
    state,
    updateFieldValue,
    setSelectedTab,
    running,
  } = useFormState();

  const { appendMessage } = useCopilotChat();

  const handleSelectPrompt = (promptText: string) => {
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
    </div>
  );
}

function SidebarContainer() {
  const { appendMessage } = useCopilotChat();

  const handleSelectPrompt = (promptText: string) => {
    appendMessage({
      role: "user",
      content: promptText,
    } as any);
  };

  const renderCustomMessage = (props: any) => (
    <CustomRenderMessage {...props} onSelectPrompt={handleSelectPrompt} />
  );

  return (
    <CopilotSidebar
      instructions={COPILOT_INSTRUCTIONS}
      labels={{
        title: "🤖 Form AI Assistant",
        placeholder: "Type: 'Set Customer Name to John', 'Which fields are empty?'...",
        stopGenerating: "Stop",
        regenerateResponse: "Regenerate",
      }}
      RenderMessage={renderCustomMessage}
      defaultOpen={false}
      clickOutsideToClose={false}
    >
      <MainContent />
    </CopilotSidebar>
  );
}

export default function App() {
  return (
    <CopilotKit runtimeUrl={RUNTIME_URL} agent="form_agent" a2ui={{ catalog: myCatalog } as any}>
      <SidebarContainer />
    </CopilotKit>
  );
}


