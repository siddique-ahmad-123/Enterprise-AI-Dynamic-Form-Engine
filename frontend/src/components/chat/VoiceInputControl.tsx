import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { useVoiceRecognition } from "../../hooks/useVoiceRecognition";

interface VoiceInputControlProps {
  onAppendText?: (text: string) => void;
}

export const VoiceInputControl: React.FC<VoiceInputControlProps> = ({ onAppendText }) => {
  const [targetContainer, setTargetContainer] = useState<HTMLElement | null>(null);

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
    supported,
    toggleListening,
    resetTranscript,
  } = useVoiceRecognition(handleTranscriptChange);

  useEffect(() => {
    const findContainer = () => {
      // Look for the controls element inside open CopilotKit chatbot input
      const container =
        document.querySelector<HTMLElement>(".copilotKitInput [class*='Controls']") ||
        document.querySelector<HTMLElement>(".copilotKitInput form") ||
        document.querySelector<HTMLElement>(".copilotKitInput");

      if (container) {
        setTargetContainer(container);
      }
    };

    findContainer();

    const observer = new MutationObserver(() => {
      findContainer();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  if (!supported) return null;

  const content = (
    <div className="relative inline-flex items-center gap-1.5 shrink-0 ml-1">
      {/* Live Voice Transcript Indicator Banner */}
      {isListening && (
        <div className="absolute right-full mr-2 bottom-0 px-3 py-1.5 bg-gradient-to-r from-red-600 to-indigo-700 text-white rounded-xl shadow-lg border border-red-400/30 flex items-center gap-2 whitespace-nowrap animate-in fade-in slide-in-from-right-2 duration-200 z-50">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-400"></span>
          </span>
          <span className="text-xs font-bold flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            Listening... Speak now
          </span>
          {(interimTranscript || transcript) && (
            <span className="text-[11px] max-w-[160px] truncate text-slate-100 font-mono bg-black/20 px-2 py-0.5 rounded-md">
              "{interimTranscript || transcript}"
            </span>
          )}
        </div>
      )}

      {/* Microphone Toggle Button */}
      <button
        type="button"
        onClick={() => {
          if (!isListening) resetTranscript();
          toggleListening();
        }}
        title={isListening ? "Stop Voice Recording" : "Start Voice Dictation (Speak to Chat)"}
        className={`p-2 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer shadow-xs active:scale-95 ${
          isListening
            ? "bg-red-600 hover:bg-red-700 text-white ring-4 ring-red-400/30 animate-pulse"
            : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80"
        }`}
      >
        {isListening ? (
          <Mic className="w-4 h-4 text-white stroke-[2.5]" />
        ) : (
          <MicOff className="w-4 h-4 text-indigo-700" />
        )}
      </button>
    </div>
  );

  if (targetContainer) {
    return ReactDOM.createPortal(content, targetContainer);
  }

  return null;
};
