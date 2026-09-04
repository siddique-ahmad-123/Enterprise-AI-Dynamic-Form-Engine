import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { Plus, History } from "lucide-react";

interface ChatHeaderActionsProps {
  onNewChat: () => void;
  onOpenHistory: () => void;
  isSubmitted?: boolean;
}

export const ChatHeaderActions: React.FC<ChatHeaderActionsProps> = ({
  onNewChat,
  onOpenHistory,
  isSubmitted = false,
}) => {
  const [headerContainer, setHeaderContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const findHeader = () => {
      const header =
        document.querySelector<HTMLElement>(".copilotKitSidebar [class*='Header']") ||
        document.querySelector<HTMLElement>(".copilotKitHeader") ||
        document.querySelector<HTMLElement>(".copilotKitChat [class*='header']");

      if (header) {
        setHeaderContainer(header);
      }
    };

    findHeader();
    const observer = new MutationObserver(() => findHeader());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const handleNewChatClick = () => {
    if (isSubmitted) {
      window.dispatchEvent(new CustomEvent("show-already-submitted"));
      return;
    }
    onNewChat();
  };

  const content = (
    <div className="inline-flex items-center gap-1.5 ml-auto mr-2">
      <button
        type="button"
        onClick={handleNewChatClick}
        title={isSubmitted ? "Application already submitted (Locked)" : "Start a new chat session"}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg backdrop-blur-xs transition-all shadow-2xs ${
          isSubmitted
            ? "text-slate-300 bg-white/10 hover:bg-white/15 cursor-not-allowed opacity-80"
            : "text-white bg-white/20 hover:bg-white/30 cursor-pointer active:scale-95"
        }`}
      >
        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
        New Chat
      </button>

      <button
        type="button"
        onClick={onOpenHistory}
        title="View saved PostgreSQL conversations"
        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-xs transition-all cursor-pointer shadow-2xs active:scale-95"
      >
        <History className="w-3.5 h-3.5" />
        History
      </button>
    </div>
  );

  if (headerContainer) {
    return ReactDOM.createPortal(content, headerContainer);
  }

  return null;
};
