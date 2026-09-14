import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { History } from "lucide-react";

interface ChatHeaderActionsProps {
  onOpenHistory: () => void;
  isSubmitted?: boolean;
}

export const ChatHeaderActions: React.FC<ChatHeaderActionsProps> = ({
  onOpenHistory,
}) => {
  const [controlsContainer, setControlsContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const findControls = () => {
      // Look for the controls container inside CopilotKit chatbot header
      const controls =
        document.querySelector<HTMLElement>(".copilotKitHeader .copilotKitHeaderControls") ||
        document.querySelector<HTMLElement>(".copilotKitHeaderControls") ||
        document.querySelector<HTMLElement>(".copilotKitHeader");

      if (controls) {
        setControlsContainer(controls);
      }
    };

    findControls();
    const observer = new MutationObserver(() => findControls());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const content = (
    <button
      type="button"
      onClick={onOpenHistory}
      title="View saved application conversations"
      className="chat-header-history-btn inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 rounded-lg border border-white/20 backdrop-blur-xs transition-all duration-150 cursor-pointer shadow-xs active:scale-95 shrink-0"
    >
      <History className="w-3.5 h-3.5" />
      <span>History</span>
    </button>
  );

  if (controlsContainer) {
    return ReactDOM.createPortal(content, controlsContainer);
  }

  return null;
};
