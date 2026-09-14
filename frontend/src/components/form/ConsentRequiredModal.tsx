import React from "react";
import { AlertCircle, CheckCircle2, ShieldCheck, ArrowRight, X } from "lucide-react";

interface ConsentRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcceptAllConsents: () => void;
  onGoToConsents: () => void;
  consentsStatus?: {
    termAndCond: boolean;
    lifestyle: boolean;
    privacy: boolean;
  };
}

export const ConsentRequiredModal: React.FC<ConsentRequiredModalProps> = ({
  isOpen,
  onClose,
  onAcceptAllConsents,
  onGoToConsents,
  consentsStatus = { termAndCond: false, lifestyle: false, privacy: false },
}) => {
  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Modal Dialog Card */}
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-[#1e295d] px-5 py-4 text-white flex items-center gap-3">
          <div className="p-2 bg-white/15 rounded-xl border border-white/20 backdrop-blur-xs">
            <ShieldCheck className="w-5 h-5 text-amber-200" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-amber-200 uppercase tracking-widest block">
              Step 0 · Prerequisite Check
            </span>
            <h3 className="font-extrabold text-sm text-white leading-tight">
              Consent &amp; Declaration Required
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/15 rounded-full transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          {/* Primary Alert Message */}
          <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-amber-950 font-bold leading-snug">
                Please do consent and declaration first then you can proceed further.
              </p>
              <p className="text-xs text-amber-800 leading-relaxed">
                Under UAE banking regulations, all legal consents, lifestyle declarations, and privacy notices must be accepted before filling or modifying application fields.
              </p>
            </div>
          </div>

          {/* Checklist of Declarations */}
          <div className="space-y-2 text-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Required Declarations in Step 0:
            </span>

            {/* Declaration 1 */}
            <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
              consentsStatus.termAndCond
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}>
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${
                  consentsStatus.termAndCond ? "text-emerald-600" : "text-slate-300"
                }`} />
                <span className="truncate text-xs font-medium">Terms, Fees &amp; Key Fact Statement</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                consentsStatus.termAndCond ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {consentsStatus.termAndCond ? "Declared" : "Pending"}
              </span>
            </div>

            {/* Declaration 2 */}
            <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
              consentsStatus.lifestyle
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}>
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${
                  consentsStatus.lifestyle ? "text-emerald-600" : "text-slate-300"
                }`} />
                <span className="truncate text-xs font-medium">Declared Lifestyle Expenses Verification</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                consentsStatus.lifestyle ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {consentsStatus.lifestyle ? "Declared" : "Pending"}
              </span>
            </div>

            {/* Declaration 3 */}
            <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
              consentsStatus.privacy
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}>
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${
                  consentsStatus.privacy ? "text-emerald-600" : "text-slate-300"
                }`} />
                <span className="truncate text-xs font-medium">Privacy Notice Acknowledgement</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                consentsStatus.privacy ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {consentsStatus.privacy ? "Declared" : "Pending"}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={onAcceptAllConsents}
              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-[#1e295d] hover:bg-[#151e45] rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Agree to All Consents &amp; Proceed</span>
            </button>

            <button
              type="button"
              onClick={onGoToConsents}
              className="w-full py-2 px-4 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Go to Consents &amp; Declarations Tab</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
