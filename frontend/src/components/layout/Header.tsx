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
      <div className="flex flex-col lg:flex-row items-stretch overflow-hidden">
        {/* Left White Brand Logo Container */}
        <div className="bg-white px-6 py-4 flex items-center justify-between lg:justify-start gap-4 min-w-[220px] relative z-10 shrink-0">
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
        <div className="flex-1 bg-[#8ba4c7] text-[#1a2b4c] px-6 py-3 flex flex-wrap items-center justify-between gap-6 shadow-inner">
          {/* Metadata Column 1 */}
          <div className="flex flex-col gap-1 text-xs">
            <div>
              <span className="text-slate-600 font-medium block text-[11px]">Application No</span>
              <span className="font-bold text-[#101b33]">WF1-0000011024-process</span>
            </div>
            <div>
              <span className="text-slate-600 font-medium block text-[11px]">Created By User</span>
              <span className="font-bold text-[#101b33]">chinmayee</span>
            </div>
          </div>

          {/* Metadata Column 2 */}
          <div className="flex flex-col gap-1 text-xs">
            <div>
              <span className="text-slate-600 font-medium block text-[11px]">Branch Code</span>
              <span className="font-bold text-[#101b33]">NB 054</span>
            </div>
            <div>
              <span className="text-slate-600 font-medium block text-[11px]">Applicant Type</span>
              <select className="bg-[#a2b8d9]/70 border border-[#6b87b0] rounded px-2.5 py-0.5 text-xs font-semibold text-[#101b33] focus:outline-none cursor-pointer">
                <option value="Main Applicant">Main Applicant</option>
                <option value="Co-Applicant">Co-Applicant</option>
                <option value="Guarantor">Guarantor</option>
              </select>
            </div>
          </div>

          {/* Metadata Column 3 */}
          <div className="flex flex-col justify-start text-xs h-full">
            <div>
              <span className="text-slate-600 font-medium block text-[11px]">Branch Name</span>
              <span className="font-bold text-[#101b33]">Noida</span>
            </div>
          </div>

          {/* Metadata Column 4 */}
          <div className="flex flex-col gap-1 text-xs">
            <div>
              <span className="text-slate-600 font-medium block text-[11px]">Status</span>
              <span className="font-bold text-[#101b33]">CIF_And_AccountCreation</span>
            </div>
            <div>
              <span className="text-slate-600 font-medium block text-[11px]">Country</span>
              <span className="font-bold text-[#101b33]">India</span>
            </div>
          </div>

          {/* Action Control Buttons */}
          <div className="flex items-center gap-2.5 ml-auto">
            {onToggleChatbot && (
              <button
                onClick={onToggleChatbot}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all border shadow-sm ${
                  isChatbotOpen
                    ? "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                    : "bg-[#1e295d] text-white border-[#1e295d] hover:bg-[#151e45]"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{isChatbotOpen ? "Hide AI Assistant" : "AI Assistant"}</span>
              </button>
            )}

            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-rose-700 bg-white/80 hover:bg-white border border-slate-300 rounded transition-all shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
