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
      <div className="flex items-start justify-end gap-2.5 my-2.5 text-xs animate-in fade-in slide-in-from-bottom-1 duration-200">
        <div className="bg-gradient-to-r from-[#1e295d] to-[#25336e] text-white px-4 py-2.5 rounded-2xl rounded-tr-xs shadow-sm shadow-indigo-950/20 max-w-[85%] font-medium leading-relaxed border border-indigo-400/20">
          {contentText}
        </div>
        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 border border-slate-300 shadow-xs">
          <User className="w-3.5 h-3.5" />
        </div>
      </div>
    );
  }

  if (message.role === "assistant") {
    const isLoading = inProgress && isCurrentMessage && !contentText;

    return (
      <div className="flex items-start gap-2.5 my-3 text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-600 via-teal-600 to-[#1e295d] text-white flex items-center justify-center shrink-0 shadow-sm border border-indigo-300/30">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0 max-w-[96%]">
          {isLoading ? (
            <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-xs flex items-center gap-2 text-slate-500">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
              </span>
              <span className="font-medium animate-pulse text-indigo-900">AI Agent Processing...</span>
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

