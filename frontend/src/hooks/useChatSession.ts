import { useState, useEffect, useCallback } from "react";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";

const STORAGE_KEY = "copilot_chat_thread_id";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export function useChatSession() {
  const [threadId, setThreadId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || `thread_${Date.now()}`;
  });

  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);

  // Synchronize localStorage
  useEffect(() => {
    if (threadId) {
      localStorage.setItem(STORAGE_KEY, threadId);
    }
  }, [threadId]);

  const loadThreadMessages = useCallback(
    async (targetThreadId: string, setMessages: (msgs: any[]) => void) => {
      setIsLoadingMessages(true);
      try {
        const res = await fetch(`${BACKEND_URL}/chat/${encodeURIComponent(targetThreadId)}`);
        if (res.ok) {
          const data = await res.json();
          const rawMsgs = data.messages || [];

          const mapped = rawMsgs.map((m: any) => {
            let content = m.content || "";
            // Embed card data if present and not already formatted
            if (
              m.role === "assistant" &&
              m.metadata &&
              Object.keys(m.metadata).length > 0 &&
              !content.includes("```json:card")
            ) {
              const cardStr = JSON.stringify(m.metadata, null, 2);
              content = `\`\`\`json:card\n${cardStr}\n\`\`\`\n\n${content}`;
            }

            try {
              return new TextMessage({
                id: `pg_msg_${m.id}`,
                role: m.role === "user" ? Role.User : Role.Assistant,
                content: content,
              });
            } catch {
              return {
                id: `pg_msg_${m.id}`,
                role: m.role,
                content: content,
              };
            }
          });

          setMessages(mapped);
          console.log(`[PostgreSQL] Loaded ${mapped.length} messages for thread '${targetThreadId}'`);
        }
      } catch (err) {
        console.warn("Failed to load thread messages from PostgreSQL:", err);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    []
  );

  const startNewChat = useCallback(
    (setMessages?: (msgs: any[]) => void) => {
      const newThread = `thread_${Date.now()}`;
      setThreadId(newThread);
      localStorage.setItem(STORAGE_KEY, newThread);
      if (setMessages) {
        setMessages([]);
      }
      console.log(`[PostgreSQL] Started new chat thread: '${newThread}'`);
      return newThread;
    },
    []
  );

  const switchThread = useCallback(
    (newThreadId: string, setMessages?: (msgs: any[]) => void) => {
      setThreadId(newThreadId);
      localStorage.setItem(STORAGE_KEY, newThreadId);
      if (setMessages) {
        loadThreadMessages(newThreadId, setMessages);
      }
    },
    [loadThreadMessages]
  );

  return {
    threadId,
    isHistoryOpen,
    setIsHistoryOpen,
    isLoadingMessages,
    loadThreadMessages,
    startNewChat,
    switchThread,
    backendUrl: BACKEND_URL,
  };
}
