import { useState, useRef, useCallback, useEffect } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

export interface UseVoiceRecognitionReturn {
  isListening: boolean;
  isTranscribing: boolean;
  transcript: string;
  interimTranscript: string;
  recordingDuration: number;
  supported: boolean;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
}

/**
 * Voice input hook powered by OpenAI Whisper (whisper-1).
 * Captures microphone audio using the standard browser MediaRecorder API
 * and sends the audio to the backend Whisper endpoint for high-accuracy speech transcription.
 */
export function useVoiceRecognition(
  onTranscriptChange?: (text: string, isFinal: boolean) => void
): UseVoiceRecognitionReturn {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const durationTimerRef = useRef<any>(null);
  const mimeTypeRef = useRef<string>("audio/webm");

  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

  // Stop tracks and release microphone
  const cleanupStream = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanupStream();
    };
  }, [cleanupStream]);

  // Transcribe recorded audio blob with OpenAI Whisper
  const sendAudioToWhisper = useCallback(
    async (audioBlob: Blob, mimeType: string) => {
      if (audioBlob.size < 500) {
        // Audio too short (< 0.5s)
        setIsTranscribing(false);
        setIsListening(false);
        return;
      }

      setIsTranscribing(true);
      setError(null);

      try {
        const formData = new FormData();
        const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
        formData.append("file", audioBlob, `voice_input.${ext}`);
        formData.append("language", "en");

        const res = await fetch(`${BACKEND_URL}/chat/transcribe`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Server error (${res.status})`);
        }

        const data = await res.json();
        const text = (data.text || "").trim();

        if (text) {
          setTranscript((prev) => {
            const updated = prev ? `${prev} ${text}` : text;
            if (onTranscriptChange) {
              onTranscriptChange(updated, true);
            }
            return updated;
          });
        }
      } catch (err: any) {
        console.error("Whisper transcription failed:", err);
        setError(err.message || "Whisper speech transcription failed. Please try again.");
      } finally {
        setIsTranscribing(false);
        setIsListening(false);
        setRecordingDuration(0);
      }
    },
    [onTranscriptChange]
  );

  const startListening = useCallback(async () => {
    if (!supported) {
      setError("Microphone audio recording is not supported in this browser environment.");
      return;
    }

    if (isListening || isTranscribing) return;

    setError(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Select most compatible supported mime type
      let selectedMime = "audio/webm";
      if (typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          selectedMime = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          selectedMime = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          selectedMime = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
          selectedMime = "audio/ogg;codecs=opus";
        }
      }
      mimeTypeRef.current = selectedMime;

      const recorder = new MediaRecorder(stream, { mimeType: selectedMime });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstart = () => {
        setIsListening(true);
        setRecordingDuration(0);
        durationTimerRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
      };

      recorder.onstop = () => {
        if (durationTimerRef.current) {
          clearInterval(durationTimerRef.current);
          durationTimerRef.current = null;
        }

        const mime = mimeTypeRef.current;
        const blob = new Blob(audioChunksRef.current, { type: mime });

        // Release hardware mic track immediately
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        // Send to Whisper
        sendAudioToWhisper(blob, mime);
      };

      recorder.onerror = (event: any) => {
        console.error("MediaRecorder error:", event);
        setError("Audio recording encountered an error.");
        cleanupStream();
        setIsListening(false);
      };

      // Collect data chunks every 250ms
      recorder.start(250);
    } catch (err: any) {
      console.error("Microphone access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Microphone permission was denied. Please allow microphone access in your browser settings.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setError("No microphone device found on your system.");
      } else {
        setError(err.message || "Failed to access microphone.");
      }
      cleanupStream();
      setIsListening(false);
    }
  }, [supported, isListening, isTranscribing, cleanupStream, sendAudioToWhisper]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("Error stopping MediaRecorder:", e);
      }
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setError(null);
    setRecordingDuration(0);
  }, []);

  return {
    isListening,
    isTranscribing,
    transcript,
    interimTranscript: "",
    recordingDuration,
    supported,
    error,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
  };
}
