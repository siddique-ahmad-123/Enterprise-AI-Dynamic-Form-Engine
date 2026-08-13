import React from "react";
import type { RenderMessageProps } from "@copilotkit/react-ui";
import { ChatCardRenderer } from "./ChatCardRenderer";
import { Bot, User } from "lucide-react";

interface CustomRenderMessageProps extends RenderMessageProps {
  onSelectPrompt?: (prompt: string) => void;
}

function getContentString(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) return (item as any).text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return content ? String(content) : "";
}

export const CustomRenderMessage: React.FC<CustomRenderMessageProps> = (props) => {
  const { message, inProgress, isCurrentMessage, onSelectPrompt } = props;
  const contentText = getContentString(message.content);

  if (message.role === "user") {
    return (
      <div className="flex items-start justify-end gap-2 my-2 text-xs">
        <div className="bg-[#1e295d] text-white px-3.5 py-2 rounded-2xl rounded-tr-xs shadow-xs max-w-[85%] font-medium leading-relaxed">
          {contentText}
        </div>
        <div className="w-7 h-7 rounded-full bg-[#1e295d]/10 text-[#1e295d] flex items-center justify-center shrink-0 border border-[#1e295d]/20">
          <User className="w-4 h-4" />
        </div>
      </div>
    );
  }

  if (message.role === "assistant") {
    const isLoading = inProgress && isCurrentMessage && !contentText;

    return (
      <div className="flex items-start gap-2.5 my-3 text-xs">
        <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs border border-indigo-700">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0 max-w-[95%]">
          {isLoading ? (
            <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-xs flex items-center gap-2 text-slate-500">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
              </span>
              <span className="font-medium animate-pulse">Generating response card...</span>
            </div>
          ) : (
            <ChatCardRenderer content={contentText} onSelectPrompt={onSelectPrompt} />
          )}
        </div>
      </div>
    );
  }

  return null;
};

