import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";
import {
  Plus,
  Brain,
  Mic,
  MicOff,
  ArrowUp,
  Square,
  Sparkles,
  FileCheck,
  Zap,
  HelpCircle,
  X
} from "lucide-react";
import { useVoiceRecognition } from "../../hooks/useVoiceRecognition";

interface ChatInputBarProps {
  onAppendText?: (text: string) => void;
  isSubmitted?: boolean;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onAppendText,
  isSubmitted = false,
}) => {
  const [inputContainer, setInputContainer] = useState<HTMLElement | null>(null);
  const [hasText, setHasText] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isThinkActive, setIsThinkActive] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Helper to update textarea value and dispatch native events
  const updateChatTextarea = (text: string) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      ".copilotKitInput textarea, textarea"
    );

    if (textarea) {
      textarea.focus();
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(textarea, text);
      } else {
        textarea.value = text;
      }

      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      setHasText(text.trim().length > 0);
    }
  };

  const handleTranscriptChange = (text: string, isFinal: boolean) => {
    updateChatTextarea(text);
    if (onAppendText && isFinal) {
      onAppendText(text);
    }
  };

  const {
    isListening,
    transcript,
    interimTranscript,
    supported: isVoiceSupported,
    toggleListening,
    resetTranscript,
  } = useVoiceRecognition(handleTranscriptChange);

  // Track textarea text & generating state from DOM
  useEffect(() => {
    const checkState = () => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        ".copilotKitInput textarea, textarea"
      );
      if (textarea) {
        setHasText(textarea.value.trim().length > 0);
      }

      // Check if CopilotKit is generating
      const stopBtn = document.querySelector(
        '[data-testid="copilot-send-button"][data-test-id="copilot-chat-request-in-progress"], [data-copilotkit-in-progress="true"]'
      );
      setIsGenerating(Boolean(stopBtn));
    };

    const container =
      document.querySelector<HTMLElement>(".copilotKitInput") ||
      document.querySelector<HTMLElement>(".copilotKitInputContainer");

    if (container) {
      setInputContainer(container);
    }

    const interval = setInterval(checkState, 200);

    const observer = new MutationObserver(() => {
      const el =
        document.querySelector<HTMLElement>(".copilotKitInput") ||
        document.querySelector<HTMLElement>(".copilotKitInputContainer");
      if (el && el !== inputContainer) {
        setInputContainer(el);
      }
      checkState();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Close plus menu on outside click
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      clearInterval(interval);
      observer.disconnect();
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [inputContainer]);

  // Handle send or voice action from the blue circular button
  const handlePrimaryAction = () => {
    if (isSubmitted) return;

    // If generating, trigger stop
    if (isGenerating) {
      const nativeBtn = document.querySelector<HTMLButtonElement>(
        '[data-testid="copilot-send-button"]'
      );
      if (nativeBtn) nativeBtn.click();
      return;
    }

    const textarea = document.querySelector<HTMLTextAreaElement>(
      ".copilotKitInput textarea, textarea"
    );

    if (textarea && textarea.value.trim().length > 0) {
      // If Think mode is enabled, we can append a prefix or let it send
      if (isThinkActive && !textarea.value.startsWith("[Deep Think]")) {
        // Option to pass deep think context if desired
      }

      const nativeBtn = document.querySelector<HTMLButtonElement>(
        '[data-testid="copilot-send-button"]'
      );

      if (nativeBtn && !nativeBtn.disabled) {
        nativeBtn.click();
        setHasText(false);
      } else {
        // Dispatch enter key on textarea
        const enterEvent = new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
        });
        textarea.dispatchEvent(enterEvent);
      }
    } else {
      // Empty input -> toggle voice recognition
      if (isVoiceSupported) {
        if (!isListening) resetTranscript();
        toggleListening();
      }
    }
  };

  const handleQuickAction = (promptText: string) => {
    updateChatTextarea(promptText);
    setShowPlusMenu(false);
    setTimeout(() => {
      const nativeBtn = document.querySelector<HTMLButtonElement>(
        '[data-testid="copilot-send-button"]'
      );
      if (nativeBtn && !nativeBtn.disabled) {
        nativeBtn.click();
      }
    }, 100);
  };

  if (!inputContainer) return null;

  const content = (
    <>
      {/* 1. Left Action: '+' Button */}
      <div className="chat-input-left-action" ref={menuRef}>
        <button
          type="button"
          onClick={() => setShowPlusMenu(!showPlusMenu)}
          disabled={isSubmitted}
          title="Quick Prompts & Actions"
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {showPlusMenu ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4 stroke-[2.2]" />}
        </button>

        {/* Plus Menu Popover */}
        {showPlusMenu && (
          <div className="absolute left-3 bottom-14 z-50 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1 flex items-center justify-between">
              <span>Quick Actions</span>
              <Sparkles className="w-3 h-3 text-blue-600" />
            </div>
            <div className="space-y-1 mt-1">
              <button
                type="button"
                onClick={() => handleQuickAction("Fill sample borrower details for John Doe with $85,000 income")}
                className="w-full text-left px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition flex items-center gap-2"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Auto-fill Sample Borrower</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction("Review all fields and check if anything is missing before submit")}
                className="w-full text-left px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition flex items-center gap-2"
              >
                <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Review Application Status</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction("What loan terms and interest rates are available?")}
                className="w-full text-left px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition flex items-center gap-2"
              >
                <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                <span>Ask Loan Questions</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Right Actions Container: [🧠 Think]  [🎤 Mic]  [🔵 Circle Voice/Send] */}
      <div className="chat-input-right-actions flex items-center gap-1.5 shrink-0">
        {/* Think / Deep Reasoning Button */}
        <button
          type="button"
          onClick={() => setIsThinkActive(!isThinkActive)}
          disabled={isSubmitted}
          title={isThinkActive ? "Think Mode Active (In-depth Analysis)" : "Toggle Think Mode"}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer select-none active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
            isThinkActive
              ? "bg-blue-100 text-blue-700 border border-blue-300 shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
          }`}
        >
          <Brain className={`w-4 h-4 ${isThinkActive ? "text-blue-600 animate-pulse" : "text-slate-500"}`} />
          <span className="text-xs">Think</span>
        </button>

        {/* Microphone Button */}
        {isVoiceSupported && (
          <div className="relative inline-flex items-center">
            {/* Live Dictation Banner */}
            {isListening && (
              <div className="absolute right-0 bottom-12 px-3 py-1.5 bg-gradient-to-r from-red-600 to-indigo-700 text-white rounded-xl shadow-lg border border-red-400/30 flex items-center gap-2 whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 duration-150 z-50">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-400"></span>
                </span>
                <span className="text-xs font-bold">Listening... Speak now</span>
                {(interimTranscript || transcript) && (
                  <span className="text-[11px] max-w-[140px] truncate text-slate-100 font-mono bg-black/20 px-2 py-0.5 rounded-md">
                    "{interimTranscript || transcript}"
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (isSubmitted) return;
                if (!isListening) resetTranscript();
                toggleListening();
              }}
              disabled={isSubmitted}
              title={isListening ? "Stop Voice Recording" : "Voice Input (Speech-to-Text)"}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                isListening
                  ? "bg-red-500 text-white animate-pulse ring-2 ring-red-300"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              {isListening ? (
                <Mic className="w-4 h-4 text-white stroke-[2.5]" />
              ) : (
                <Mic className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>
        )}

        {/* Blue Circular Waveform / Send Button */}
        <button
          type="button"
          onClick={handlePrimaryAction}
          disabled={isSubmitted && !isGenerating}
          title={
            isGenerating
              ? "Stop generating"
              : hasText
              ? "Send message"
              : "Voice assistant / Speak"
          }
          className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-[#1e295d] hover:from-blue-700 hover:to-[#151e45] text-white flex items-center justify-center shadow-md hover:shadow-lg active:scale-90 transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {isGenerating ? (
            <Square className="w-3.5 h-3.5 fill-current" />
          ) : hasText ? (
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          ) : (
            /* Sound Waveform Icon (|||) */
            <div className="flex items-center gap-[2.5px] px-1">
              <span className="w-[2.5px] h-2.5 bg-white rounded-full"></span>
              <span className="w-[2.5px] h-4 bg-white rounded-full animate-pulse"></span>
              <span className="w-[2.5px] h-2 bg-white rounded-full"></span>
              <span className="w-[2.5px] h-3 bg-white rounded-full animate-pulse"></span>
            </div>
          )}
        </button>
      </div>
    </>
  );

  return ReactDOM.createPortal(content, inputContainer);
};
