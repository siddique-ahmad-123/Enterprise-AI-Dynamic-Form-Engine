import React from "react";
import { Sparkles, Send } from "lucide-react";

interface QuickActionsProps {
  onSelectPrompt: (prompt: string) => void;
}

const PRESET_PROMPTS = [
  "Set Customer Name to John Doe",
  "Update Customer ID as CUST10293",
  "Change Risk Rating to High",
  "Update KYC Status to Verified",
  "Change Account Balance to 50000",
  "Navigate to Account Info tab",
  "Which fields are empty?",
  "Summarize the form",
];

export const QuickActions: React.FC<QuickActionsProps> = ({ onSelectPrompt }) => {
  return (
    <div className="mt-6 p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-bold text-slate-100">
          Quick AI Test Commands
        </h3>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        Click any preset command to test natural language form manipulation & tree traversal:
      </p>

      <div className="flex flex-wrap gap-2">
        {PRESET_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onSelectPrompt(prompt)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/40 rounded-xl transition-all"
          >
            {prompt}
            <Send className="w-3 h-3 text-indigo-400" />
          </button>
        ))}
      </div>
    </div>
  );
};
