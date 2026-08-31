import React from "react";
import { RotateCcw, Sparkles } from "lucide-react";

interface HeaderProps {
  onReset: () => void;
  onToggleChatbot?: () => void;
  isChatbotOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  onToggleChatbot,
  isChatbotOpen = false,
}) => {
  return (
    <header className="w-full bg-white shadow-sm border-b border-slate-200">
      <div className="flex flex-col lg:flex-row items-stretch">
        {/* Left White Brand Logo Container */}
        <div className="bg-white px-4 sm:px-6 py-3 flex items-center justify-between lg:justify-start gap-3 min-w-0 lg:min-w-[200px] relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            {/* Newgen Globe Logo SVG */}
            <div className="relative w-9 h-9 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#1e295d" strokeWidth="6" />
                <path d="M 25 50 Q 50 20 75 50" fill="none" stroke="#f97316" strokeWidth="6" strokeLinecap="round" />
                <circle cx="70" cy="30" r="6" fill="#f97316" />
                <circle cx="30" cy="70" r="5" fill="#1e295d" />
              </svg>
            </div>
            <span className="text-2xl font-black tracking-tighter text-[#1e295d] font-sans">
              newgen
            </span>
          </div>

          {/* Curved Transition Wave for Large Screens */}
          <div className="hidden lg:block absolute right-0 top-0 bottom-0 translate-x-full pointer-events-none z-20">
            <svg viewBox="0 0 40 100" preserveAspectRatio="none" className="h-full w-10 fill-white">
              <path d="M 0 0 C 30 20 10 80 40 100 L 0 100 Z" />
            </svg>
          </div>
        </div>

        {/* Right Steel-Blue Banner Background (#8ba4c7) */}
        <div className="flex-1 bg-[#8ba4c7] text-[#1a2b4c] px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 shadow-inner overflow-x-auto">
          {/* Metadata columns — compact on mobile, expanded on sm+ */}
          <div className="flex flex-wrap items-start gap-x-4 gap-y-1.5 text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-600 font-medium text-[10px] uppercase tracking-wide">App No</span>
              <span className="font-bold text-[#101b33] whitespace-nowrap">WF1-0000011024</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-600 font-medium text-[10px] uppercase tracking-wide">Created By</span>
              <span className="font-bold text-[#101b33]">chinmayee</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-600 font-medium text-[10px] uppercase tracking-wide">Branch</span>
              <span className="font-bold text-[#101b33]">NB 054 · Noida</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-600 font-medium text-[10px] uppercase tracking-wide">Status</span>
              <span className="font-bold text-[#101b33] whitespace-nowrap">CIF_And_AccountCreation</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-600 font-medium text-[10px] uppercase tracking-wide">Applicant Type</span>
              <select className="bg-[#a2b8d9]/70 border border-[#6b87b0] rounded px-2 py-0.5 text-xs font-semibold text-[#101b33] focus:outline-none cursor-pointer transition-colors hover:bg-[#b3c8e0]/80">
                <option value="Main Applicant">Main Applicant</option>
                <option value="Co-Applicant">Co-Applicant</option>
                <option value="Guarantor">Guarantor</option>
              </select>
            </div>
          </div>

          {/* Action Control Buttons */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            {onToggleChatbot && (
              <button
                onClick={onToggleChatbot}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border shadow-sm active:scale-95 ${
                  isChatbotOpen
                    ? "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                    : "bg-[#1e295d] text-white border-[#1e295d] hover:bg-[#151e45]"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">{isChatbotOpen ? "Hide AI" : "AI Assistant"}</span>
              </button>
            )}

            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-rose-700 bg-white/80 hover:bg-white border border-slate-300 rounded-lg transition-all duration-200 shadow-sm active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
