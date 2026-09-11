import React from "react";
import { Lock, CheckCircle2, X } from "lucide-react";

interface AlreadySubmittedModalProps {
  submissionRef: string | null;
  submissionDate: string | null;
  onClose: () => void;
}

export const AlreadySubmittedModal: React.FC<AlreadySubmittedModalProps> = ({
  submissionRef,
  submissionDate,
  onClose,
}) => {
  const formattedDate = submissionDate
    ? new Date(submissionDate).toLocaleString()
    : null;

  // Close on Escape key
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* stopPropagation so clicking inside the card doesn't close */}
      <div
        className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-5 py-4 text-white flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-xl border border-white/20">
            <Lock className="w-5 h-5 text-slate-200" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Application Locked
            </span>
            <h3 className="font-extrabold text-sm text-white leading-tight">
              Already Submitted
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900 font-medium leading-relaxed">
              Your application has already been submitted and is currently under{" "}
              <span className="font-bold">Underwriting Sanction Review</span>. No further submissions are permitted.
            </p>
          </div>

          {submissionRef && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 font-medium">Reference ID</span>
                <span className="font-mono font-bold text-slate-800">{submissionRef}</span>
              </div>
              {formattedDate && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 font-medium">Submitted On</span>
                  <span className="text-slate-700 font-semibold">{formattedDate}</span>
                </div>
              )}
              <div className="flex items-center justify-between p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-amber-700 font-medium">Current Status</span>
                <span className="font-bold text-amber-800 text-[11px] bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                  Underwriting Sanction Review
                </span>
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-400 text-center">
            You may review your application details using the{" "}
            <span className="font-semibold text-slate-600">Review &amp; Edit</span> button.
          </p>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
