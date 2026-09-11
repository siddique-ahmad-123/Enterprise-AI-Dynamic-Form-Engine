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

  const content = (
    <div className="inline-flex items-center gap-1.5 ml-auto mr-2">
      <button
        type="button"
        onClick={onOpenHistory}
        title="View saved application conversations"
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
