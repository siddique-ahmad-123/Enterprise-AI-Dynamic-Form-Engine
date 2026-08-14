import React from "react";
import { Sparkles, Send } from "lucide-react";

interface QuickActionsProps {
  onSelectPrompt: (prompt: string) => void;
}

const PRESET_PROMPTS = [
  "Yes, I agree to the terms and declarations",
  "My name is John Doe, DOB 1995-05-15, mobile +971501234567, email john@example.com",
  "Flat 402, Sunshine Apartments, MG Road, Andheri West, Mumbai, Maharashtra 400058, India",
  "No co-borrower",
  "I am Salaried at Emaar Properties, employed from 2020-01-15, monthly salary 45000",
  "Home Purchase Loan, amount 2500000, tenure 240, rate 4.5",
  "My mobile number is wrong; change it to +971509876543",
  "Review application",
  "Submit Application",
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
