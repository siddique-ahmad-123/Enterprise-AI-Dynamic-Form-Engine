import { useState, useEffect, useRef, useCallback } from "react";

// Extend Window interface for Web Speech API vendor prefixes
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export interface UseVoiceRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  supported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
}

export function useVoiceRecognition(
  onTranscriptChange?: (text: string, isFinal: boolean) => void
): UseVoiceRecognitionReturn {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean>(true);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      setError("Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let finalStr = "";
        let interimStr = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0]?.transcript || "";
          if (res.isFinal) {
            finalStr += text + " ";
          } else {
            interimStr += text;
          }
        }

        if (finalStr) {
          setTranscript((prev) => {
            const updated = (prev + " " + finalStr).trim();
            if (onTranscriptChange) onTranscriptChange(updated, true);
            return updated;
          });
        }

        setInterimTranscript(interimStr);
        if (interimStr && onTranscriptChange) {
          onTranscriptChange(interimStr, false);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "no-speech") {
          // Ignore transient no-speech timeouts
          return;
        }
        setError(`Speech error: ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (e: any) {
      console.error("Failed to initialize Speech Recognition:", e);
      setSupported(false);
      setError("Speech recognition failed to initialize.");
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore cleanup stop errors
        }
      }
    };
  }, [onTranscriptChange]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        setError(null);
        recognitionRef.current.start();
      } catch (e) {
        console.warn("Error starting speech recognition:", e);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {
        console.warn("Error stopping speech recognition:", e);
      }
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    supported,
    error,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
  };
}
