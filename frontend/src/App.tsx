import React, { useEffect, useState } from "react";
import "@copilotkit/react-ui/styles.css";
import { CopilotKit, useCopilotChat, useCopilotChatInternal } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";

import { FormRenderer } from "./components/form/FormRenderer";
import { ReviewModal } from "./components/form/ReviewModal";
import { QuickActions } from "./components/ui/QuickActions";
import { CustomRenderMessage } from "./components/chat/CustomRenderMessage";
import { ChatInputBar } from "./components/chat/ChatInputBar";
import { ChatHeaderActions } from "./components/chat/ChatHeaderActions";
import { ChatHistoryModal } from "./components/chat/ChatHistoryModal";
import { LoginScreen } from "./components/auth/LoginScreen";
import { AlreadySubmittedModal } from "./components/auth/AlreadySubmittedModal";
import { ConsentRequiredModal } from "./components/form/ConsentRequiredModal";
import { Dashboard } from "./components/Dashboard";
import { useFormState } from "./hooks/useFormState";
import { useChatSession } from "./hooks/useChatSession";
import { myCatalog } from "./a2ui/catalog";
import { FileText, Sparkles, History, LogOut, ArrowLeft, LayoutDashboard } from "lucide-react";

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_USER_KEY = "auth_username";
// Empty string = relative path → Vite proxy (local dev); explicit URL bypasses proxy (Docker/prod)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

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
  import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "/copilotkit";

interface MainContentProps {
  onOpenHistory: () => void;
  currentThreadId: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  authUser?: string | null;
  onLogout?: () => void;
  isSubmitted?: boolean;
  onBackToDashboard?: () => void;
}

function MainContent({
  onOpenHistory,
  currentThreadId,
  isSidebarOpen,
  onToggleSidebar,
  authUser,
  onLogout,
  isSubmitted,
  onBackToDashboard,
}: MainContentProps) {
  const {
    state,
    updateFieldValue,
    updateMultipleFields,
    acceptAllConsents,
    setSelectedTab,
    setJourneyStatus,
    resetForm,
    running,
  } = useFormState(currentThreadId, Boolean(isSubmitted));

  const { appendMessage } = useCopilotChat();
  const [isReviewOpen, setIsReviewOpen] = React.useState<boolean>(false);
  const [showConsentModal, setShowConsentModal] = React.useState<boolean>(false);

  const effectiveSubmitted = Boolean(isSubmitted || state.journeyStatus === "SUBMITTED");

  // Keep coAgent journeyStatus in sync so the backend guards against re-submission on any thread
  React.useEffect(() => {
    if (effectiveSubmitted && state.journeyStatus !== "SUBMITTED") {
      setJourneyStatus("SUBMITTED");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSubmitted]);

  React.useEffect(() => {
    const handleOpenReview = () => setIsReviewOpen(true);
    const handleShowConsent = () => setShowConsentModal(true);
    window.addEventListener("open-review-modal", handleOpenReview);
    window.addEventListener("show-consent-required", handleShowConsent);
    return () => {
      window.removeEventListener("open-review-modal", handleOpenReview);
      window.removeEventListener("show-consent-required", handleShowConsent);
    };
  }, []);

  React.useEffect(() => {
    if (state.lastAction?.action_type === "CONSENT_REQUIRED") {
      setShowConsentModal(true);
    }
  }, [state.lastAction]);

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
    if (effectiveSubmitted) {
      window.dispatchEvent(new CustomEvent("show-already-submitted"));
      return;
    }
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
          {effectiveSubmitted && (
            <span className="inline-flex items-center text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md flex-shrink-0">
              🔒 Submitted
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Back to Dashboard Button */}
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              title="Return to Application Dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1e295d] bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-all duration-150 shadow-xs cursor-pointer active:scale-[0.97]"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
          )}

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

          {/* Logged-in user + Logout */}
          {authUser && (
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">
                {authUser}
              </span>
              <button
                onClick={onLogout}
                title="Sign out"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all duration-150 shadow-xs cursor-pointer active:scale-[0.97]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          )}
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
          isSubmitted={effectiveSubmitted}
        />

        {/* Single-Page Editable Review & Edit Modal */}
        <ReviewModal
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          formTree={state.formTree}
          fieldValues={state.fieldValues}
          onFieldChange={updateFieldValue}
          onSubmitApplication={handleConfirmSubmit}
          isSubmitted={effectiveSubmitted}
        />

        {/* Step 0 Consent & Declaration Required Modal */}
        <ConsentRequiredModal
          isOpen={showConsentModal}
          onClose={() => setShowConsentModal(false)}
          onAcceptAllConsents={() => {
            acceptAllConsents();
            setShowConsentModal(false);
          }}
          onGoToConsents={() => {
            setSelectedTab("tab_consents");
            setShowConsentModal(false);
          }}
          consentsStatus={{
            termAndCond: Boolean(state.fieldValues["isCheckedTermandCond"]),
            lifestyle: Boolean(state.fieldValues["isCheckedLifestyle"]),
            privacy: Boolean(state.fieldValues["isCheckedPrivacy"]),
          }}
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
  switchThread,
  backendUrl,
  authUser,
  onLogout,
  isSubmitted,
  onBackToDashboard,
}: ReturnType<typeof useChatSession> & {
  authUser?: string | null;
  onLogout?: () => void;
  isSubmitted?: boolean;
  onBackToDashboard?: () => void;
}) {
  const { appendMessage } = useCopilotChat();
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
          title: "🤖 AI Form Assistant",
          placeholder: isSubmitted ? "Application submitted (Locked under review)" : "Ask anything",
          stopGenerating: "Stop",
          regenerateResponse: "Regenerate",
        }}
        RenderMessage={renderCustomMessage}
        defaultOpen={false}
        onSetOpen={setIsSidebarOpen}
        clickOutsideToClose={false}
      >
        <MainContent
          onOpenHistory={() => setIsHistoryOpen(true)}
          currentThreadId={threadId}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => {
            const btn = document.querySelector<HTMLButtonElement>(".copilotKitButton");
            btn?.click();
          }}
          authUser={authUser}
          onLogout={onLogout}
          isSubmitted={isSubmitted}
          onBackToDashboard={onBackToDashboard}
        />
      </CopilotSidebar>

      {/* Header Actions (History) Portaled into Chat Window Header */}
      <ChatHeaderActions
        onOpenHistory={() => setIsHistoryOpen(true)}
        isSubmitted={isSubmitted}
      />

      {/* Modern Chat Input Bar (Plus, Think, Mic, Blue Waveform) Portaled inside Chatbot Input */}
      <ChatInputBar isSubmitted={isSubmitted} />

      {/* PostgreSQL Chat History & Sessions Management Modal */}
      <ChatHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        currentThreadId={threadId}
        onSelectThread={handleSelectThread}
        backendUrl={backendUrl}
        authUser={authUser}
        isSubmitted={isSubmitted}
      />
    </>
  );
}

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(
    () => localStorage.getItem(AUTH_TOKEN_KEY)
  );
  const [authUser, setAuthUser] = useState<string | null>(
    () => localStorage.getItem(AUTH_USER_KEY)
  );
  const [currentView, setCurrentView] = useState<"dashboard" | "workspace">("dashboard");
  const chatSession = useChatSession(authUser);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionRef, setSubmissionRef] = useState<string | null>(null);
  const [submissionDate, setSubmissionDate] = useState<string | null>(null);
  const [showSubmittedModal, setShowSubmittedModal] = useState(false);
  const modalBlockedRef = React.useRef(false);

  const checkThreadSubmissionStatus = async (targetThreadId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/chat/submission-status/${encodeURIComponent(targetThreadId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.has_submitted) {
          setIsSubmitted(true);
          setSubmissionRef(data.submission_ref);
          setSubmissionDate(data.submitted_at);
          return;
        }
      }
      setIsSubmitted(false);
      setSubmissionRef(null);
      setSubmissionDate(null);
    } catch { /* ignore network errors silently */ }
  };

  const handleAuthenticated = (username: string, token: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, username);
    setAuthToken(token);
    setAuthUser(username);
    setCurrentView("dashboard");
  };

  // Check thread submission status when active thread changes
  useEffect(() => {
    if (chatSession.threadId) {
      checkThreadSubmissionStatus(chatSession.threadId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatSession.threadId]);

  // Mark thread and user as submitted when success card renders (fired by ChatCardRenderer)
  useEffect(() => {
    const onSuccess = async (e: Event) => {
      const { ref, date } = (e as CustomEvent).detail ?? {};
      setIsSubmitted(true);
      setSubmissionRef(ref ?? null);
      setSubmissionDate(date ?? null);
      const user = localStorage.getItem(AUTH_USER_KEY);
      if (chatSession.threadId && ref) {
        try {
          await fetch(`${BACKEND_URL}/chat/mark-submitted`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ thread_id: chatSession.threadId, submission_ref: ref, username: user }),
          });
          if (user) {
            await fetch(`${BACKEND_URL}/auth/mark-submitted`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: user, submission_ref: ref }),
            });
          }
        } catch { /* non-critical */ }
      }
    };
    window.addEventListener("submission-success", onSuccess);
    return () => window.removeEventListener("submission-success", onSuccess);
  }, [chatSession.threadId]);

  // Show modal when any component fires show-already-submitted
  useEffect(() => {
    const show = () => {
      if (!modalBlockedRef.current) setShowSubmittedModal(true);
    };
    window.addEventListener("show-already-submitted", show);
    return () => window.removeEventListener("show-already-submitted", show);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setAuthToken(null);
    setAuthUser(null);
    setIsSubmitted(false);
    setSubmissionRef(null);
    setSubmissionDate(null);
    setCurrentView("dashboard");
  };

  const handleStartNewApplication = async () => {
    await chatSession.createAndSwitchNewThread();
    setIsSubmitted(false);
    setSubmissionRef(null);
    setSubmissionDate(null);
    setCurrentView("workspace");
  };

  const handleSelectApplication = (selectedThreadId: string, isSub: boolean, subRef?: string | null) => {
    chatSession.switchThread(selectedThreadId);
    setIsSubmitted(isSub);
    setSubmissionRef(subRef || null);
    setCurrentView("workspace");
  };

  if (!authToken) {
    return <LoginScreen onAuthenticated={handleAuthenticated} />;
  }

  if (currentView === "dashboard") {
    return (
      <Dashboard
        authUser={authUser}
        onLogout={handleLogout}
        onStartNewApplication={handleStartNewApplication}
        onSelectApplication={handleSelectApplication}
        backendUrl={BACKEND_URL || ""}
      />
    );
  }

  return (
    <CopilotKit
      key={chatSession.threadId}
      runtimeUrl={RUNTIME_URL}
      agent="form_agent"
      threadId={chatSession.threadId}
      a2ui={{ catalog: myCatalog } as any}
    >
      <SidebarContainer
        {...chatSession}
        authUser={authUser}
        onLogout={handleLogout}
        isSubmitted={isSubmitted}
        onBackToDashboard={() => setCurrentView("dashboard")}
      />
      {showSubmittedModal && (
        <AlreadySubmittedModal
          submissionRef={submissionRef}
          submissionDate={submissionDate}
          onClose={() => {
            // Block re-open for 500 ms to prevent event loop re-trigger
            modalBlockedRef.current = true;
            setShowSubmittedModal(false);
            setTimeout(() => { modalBlockedRef.current = false; }, 500);
          }}
        />
      )}
    </CopilotKit>
  );
}
