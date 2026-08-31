import React, { useEffect } from "react";
import "@copilotkit/react-ui/styles.css";
import { CopilotKit, useCopilotChat, useCopilotChatInternal } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";

import { FormRenderer } from "./components/form/FormRenderer";
import { ReviewModal } from "./components/form/ReviewModal";
import { QuickActions } from "./components/ui/QuickActions";
import { CustomRenderMessage } from "./components/chat/CustomRenderMessage";
import { VoiceInputControl } from "./components/chat/VoiceInputControl";
import { ChatHeaderActions } from "./components/chat/ChatHeaderActions";
import { ChatHistoryModal } from "./components/chat/ChatHistoryModal";
import { useFormState } from "./hooks/useFormState";
import { useChatSession } from "./hooks/useChatSession";
import { myCatalog } from "./a2ui/catalog";
import { FileText, Sparkles, Plus, History } from "lucide-react";

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

interface MainContentProps {
  onNewChat: () => void;
  onOpenHistory: () => void;
  currentThreadId: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

function MainContent({ onNewChat, onOpenHistory, currentThreadId, isSidebarOpen, onToggleSidebar }: MainContentProps) {
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
      <div className="w-full bg-white border-b border-slate-200 px-3 sm:px-6 py-2 flex items-center justify-between gap-2 shadow-xs flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2 min-w-0 flex-shrink">
          <span className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex-shrink-0">
            <Sparkles className="w-4 h-4" />
          </span>
          <span className="text-xs font-bold text-slate-800 truncate">
            <span className="hidden sm:inline">Newgen Enterprise AI Loan Application Portal</span>
            <span className="sm:hidden">Newgen AI Portal</span>
          </span>
          <span className="hidden lg:inline-flex text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 whitespace-nowrap flex-shrink-0">
            Thread: {currentThreadId.slice(-8)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* AI Sidebar Toggle */}
          <button
            onClick={onToggleSidebar}
            title={isSidebarOpen ? "Close AI Assistant" : "Open AI Assistant"}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all duration-200 border shadow-xs cursor-pointer active:scale-[0.97] ${
              isSidebarOpen
                ? "text-white bg-[#1e295d] border-[#1e295d] hover:bg-[#151e45]"
                : "text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isSidebarOpen ? "Close AI" : "AI Assistant"}</span>
          </button>

          {/* New Chat Button */}
          <button
            onClick={onNewChat}
            title="Start a fresh conversation thread in PostgreSQL"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all duration-150 shadow-xs cursor-pointer active:scale-[0.97]"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          {/* Past Chats History Button */}
          <button
            onClick={onOpenHistory}
            title="View and restore previous conversations from PostgreSQL"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all duration-150 shadow-xs cursor-pointer active:scale-[0.97]"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chat History</span>
          </button>

          {/* Review Modal Button */}
          <button
            onClick={() => setIsReviewOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all duration-150 shadow-xs cursor-pointer active:scale-[0.97]"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Review &amp; Edit</span>
          </button>
        </div>
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

function SidebarContainer({
  threadId,
  isHistoryOpen,
  setIsHistoryOpen,
  loadThreadMessages,
  startNewChat,
  switchThread,
  backendUrl,
}: ReturnType<typeof useChatSession>) {
  const { appendMessage, reset } = useCopilotChat();
  const chatInternal = useCopilotChatInternal();
  const setMessages = (chatInternal as any)?.setMessages;
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  // Load stored PostgreSQL chat messages for active thread on mount
  useEffect(() => {
    if (threadId && setMessages) {
      loadThreadMessages(threadId, setMessages);
    }
  }, [threadId, loadThreadMessages, setMessages]);

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

  const handleNewChat = () => {
    startNewChat(setMessages);
    try {
      reset?.();
    } catch (e) {
      console.debug("Chat reset:", e);
    }
  };

  const handleSelectThread = (selectedThreadId: string) => {
    switchThread(selectedThreadId, setMessages);
  };

  const renderCustomMessage = (props: any) => (
    <CustomRenderMessage {...props} onSelectPrompt={handleSelectPrompt} />
  );

  return (
    <>
      <CopilotSidebar
        instructions={COPILOT_INSTRUCTIONS}
        labels={{
          title: "🤖 Form AI Assistant",
          placeholder: "Type or speak: 'Set Customer Name to John'...",
          stopGenerating: "Stop",
          regenerateResponse: "Regenerate",
        }}
        RenderMessage={renderCustomMessage}
        defaultOpen={false}
        onSetOpen={setIsSidebarOpen}
        clickOutsideToClose={false}
      >
        <MainContent
          onNewChat={handleNewChat}
          onOpenHistory={() => setIsHistoryOpen(true)}
          currentThreadId={threadId}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => {
            const btn = document.querySelector<HTMLButtonElement>(".copilotKitButton");
            btn?.click();
          }}
        />
      </CopilotSidebar>

      {/* Header Actions (New Chat / History) Portaled into Chat Window Header */}
      <ChatHeaderActions
        onNewChat={handleNewChat}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Voice Dictation Control Portaled inside Chatbot Input */}
      <VoiceInputControl />

      {/* PostgreSQL Chat History & Sessions Management Modal */}
      <ChatHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        currentThreadId={threadId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
        backendUrl={backendUrl}
      />
    </>
  );
}

export default function App() {
  const chatSession = useChatSession();

  return (
    <CopilotKit
      runtimeUrl={RUNTIME_URL}
      agent="form_agent"
      threadId={chatSession.threadId}
      a2ui={{ catalog: myCatalog } as any}
    >
      <SidebarContainer {...chatSession} />
    </CopilotKit>
  );
}
