import { useState, useEffect, useCallback, useRef } from "react";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

const getUserStorageKey = (user?: string | null) => `copilot_chat_thread_id_${(user || "anonymous").toLowerCase()}`;

export function useChatSession(authUser?: string | null) {
  const [threadId, setThreadId] = useState<string>(() => {
    if (authUser) {
      const key = getUserStorageKey(authUser);
      return localStorage.getItem(key) || `thread_usr_${authUser.toLowerCase()}`;
    }
    return localStorage.getItem(getUserStorageKey(null)) || `thread_usr_anonymous`;
  });

  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const prevUserRef = useRef<string | null | undefined>(authUser);

  // When authUser changes, resolve the canonical thread from backend or deterministic user key
  useEffect(() => {
    if (!authUser) {
      const anonThread = localStorage.getItem(getUserStorageKey(null)) || `thread_usr_anonymous`;
      setThreadId(anonThread);
      prevUserRef.current = authUser;
      return;
    }

    if (prevUserRef.current !== authUser) {
      prevUserRef.current = authUser;
      const deterministicThread = `thread_usr_${authUser.toLowerCase()}`;
      const cached = localStorage.getItem(getUserStorageKey(authUser));
      const targetThread = cached || deterministicThread;
      setThreadId(targetThread);
      localStorage.setItem(getUserStorageKey(authUser), targetThread);

      // Verify canonical thread ID with backend
      fetch(`${BACKEND_URL}/auth/user-thread?username=${encodeURIComponent(authUser)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.thread_id && data.thread_id !== targetThread) {
            setThreadId(data.thread_id);
            localStorage.setItem(getUserStorageKey(authUser), data.thread_id);
          }
        })
        .catch(() => {});
    }
  }, [authUser]);

  // Synchronize localStorage and backend user association
  useEffect(() => {
    if (threadId && authUser) {
      const key = getUserStorageKey(authUser);
      localStorage.setItem(key, threadId);
      fetch(`${BACKEND_URL}/chat/${encodeURIComponent(threadId)}/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUser }),
      }).catch(() => {});
    }
  }, [threadId, authUser]);

  const loadThreadMessages = useCallback(
    async (targetThreadId: string, setMessages: (msgs: any[]) => void) => {
      if (!targetThreadId) return;
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
      // For authenticated users, maintain their canonical thread ID (One Thread per User)
      const userThread = authUser ? `thread_usr_${authUser.toLowerCase()}` : `thread_usr_anonymous`;
      setThreadId(userThread);
      const key = getUserStorageKey(authUser);
      localStorage.setItem(key, userThread);

      if (authUser) {
        fetch(`${BACKEND_URL}/chat/${encodeURIComponent(userThread)}/user`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: authUser }),
        }).catch(() => {});
      }

      if (setMessages) {
        loadThreadMessages(userThread, setMessages);
      }
      return userThread;
    },
    [authUser, loadThreadMessages]
  );

  const switchThread = useCallback(
    (newThreadId: string, setMessages?: (msgs: any[]) => void) => {
      setThreadId(newThreadId);
      const key = getUserStorageKey(authUser);
      localStorage.setItem(key, newThreadId);
      if (authUser) {
        fetch(`${BACKEND_URL}/chat/${encodeURIComponent(newThreadId)}/user`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: authUser }),
        }).catch(() => {});
      }
      if (setMessages) {
        loadThreadMessages(newThreadId, setMessages);
      }
    },
    [authUser, loadThreadMessages]
  );

  const createAndSwitchNewThread = useCallback(
    async (setMessages?: (msgs: any[]) => void) => {
      try {
        const user = authUser || "anonymous";
        const res = await fetch(`${BACKEND_URL}/applications/new`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: user }),
        });
        if (res.ok) {
          const data = await res.json();
          const newThreadId = data.thread_id;
          if (newThreadId) {
            setThreadId(newThreadId);
            const key = getUserStorageKey(authUser);
            localStorage.setItem(key, newThreadId);
            if (setMessages) {
              setMessages([]);
            }
            return newThreadId;
          }
        }
      } catch (e) {
        console.error("Failed to create new application journey thread:", e);
      }
      // Fallback
      const fallbackThread = `thread_usr_${(authUser || "anonymous").toLowerCase()}_${Date.now()}`;
      setThreadId(fallbackThread);
      const key = getUserStorageKey(authUser);
      localStorage.setItem(key, fallbackThread);
      if (setMessages) {
        setMessages([]);
      }
      return fallbackThread;
    },
    [authUser]
  );

  return {
    threadId,
    setThreadId,
    isHistoryOpen,
    setIsHistoryOpen,
    isLoadingMessages,
    loadThreadMessages,
    startNewChat,
    createAndSwitchNewThread,
    switchThread,
    backendUrl: BACKEND_URL,
  };
}
