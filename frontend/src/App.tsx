import React from "react";
import "@copilotkit/react-ui/styles.css";
import { CopilotKit, useCopilotChat } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";

import { FormRenderer } from "./components/form/FormRenderer";
import { ReviewModal } from "./components/form/ReviewModal";
import { QuickActions } from "./components/ui/QuickActions";
import { CustomRenderMessage } from "./components/chat/CustomRenderMessage";
import { useFormState } from "./hooks/useFormState";
import { myCatalog } from "./a2ui/catalog";
import { FileText, Sparkles } from "lucide-react";

const COPILOT_INSTRUCTIONS = `
You are the AI Dynamic Form Assistant — an enterprise form engine assistant for Newgen Loan Applications.

Capabilities:
1. Understand natural language requests to update, query, or clear fields in a dynamic form hierarchy across all 6 tabs.
2. Traversal: Recursively traverse form nodes (Form -> Tab -> Section -> Panel -> Group -> Container -> Field).
3. Semantic matching: Match labels to exact node_ids across tabs.
4. Readonly Rules: IF A FIELD HAS readonly=true, DO NOT MODIFY IT.
5. Multi-Tab Flow: Guide the applicant step-by-step from Consents (Step 0) through Personal Details (Step 1), Co-Borrower (Step 2), Income (Step 3), Loan (Step 4), Decision (Step 5), Review Stage, and Submission.
6. Single-Page Review: Trigger review popup and handle conversational corrections.

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
  const [isReviewOpen, setIsReviewOpen] = React.useState<boolean>(false);

  React.useEffect(() => {
    const handleOpenReview = () => setIsReviewOpen(true);
    window.addEventListener("open-review-modal", handleOpenReview);
    return () => window.removeEventListener("open-review-modal", handleOpenReview);
  }, []);

  const handleSelectPrompt = (promptText: string) => {
    try {
      appendMessage(
        new TextMessage({
          role: Role.User,
          content: promptText,
        })
      );
    } catch (e) {
      console.warn("appendMessage with TextMessage failed, trying fallback:", e);
      appendMessage({
        role: "user",
        content: promptText,
      } as any);
    }
  };

  const handleConfirmSubmit = () => {
    try {
      appendMessage(
        new TextMessage({
          role: Role.User,
          content: "Submit Application",
        })
      );
    } catch (e) {
      appendMessage({
        role: "user",
        content: "Submit Application",
      } as any);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-900 pb-16 font-sans antialiased">
      {/* Top Banner Toolbar */}
      <div className="w-full bg-white border-b border-slate-200 px-4 md:px-8 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
            <Sparkles className="w-4 h-4" />
          </span>
          <span className="text-xs font-bold text-slate-800">
            Newgen Enterprise AI Loan Application Portal
          </span>
        </div>

        <button
          onClick={() => setIsReviewOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all shadow-xs cursor-pointer active:scale-[0.98]"
        >
          <FileText className="w-4 h-4" />
          📋 Single-Page Review & Edit
        </button>
      </div>

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

        {/* Single-Page Editable Review & Edit Modal */}
        <ReviewModal
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          formTree={state.formTree}
          fieldValues={state.fieldValues}
          onFieldChange={updateFieldValue}
          onSubmitApplication={handleConfirmSubmit}
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
    try {
      appendMessage(
        new TextMessage({
          role: Role.User,
          content: promptText,
        })
      );
    } catch (e) {
      appendMessage({
        role: "user",
        content: promptText,
      } as any);
    }
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


