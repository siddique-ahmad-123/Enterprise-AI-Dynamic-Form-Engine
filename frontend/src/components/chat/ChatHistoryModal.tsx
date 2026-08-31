import React, { useEffect, useState } from "react";
import { History, Plus, Trash2, MessageSquare, Clock, X, Check, Loader2, Sparkles } from "lucide-react";

interface ChatSession {
  thread_id: string;
  message_count: number;
  started_at: string;
  last_activity: string;
  title_preview: string;
}

interface ChatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentThreadId: string;
  onSelectThread: (threadId: string) => void;
  onNewChat: () => void;
  backendUrl?: string;
}

export const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({
  isOpen,
  onClose,
  currentThreadId,
  onSelectThread,
  onNewChat,
  backendUrl = "http://localhost:8000",
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/chat/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.warn("Failed to fetch chat sessions from PostgreSQL:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const handleDelete = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this chat history?")) return;

    setDeletingId(threadId);
    try {
      const res = await fetch(`${backendUrl}/chat/${encodeURIComponent(threadId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.thread_id !== threadId));
        if (currentThreadId === threadId) {
          onNewChat();
        }
      }
    } catch (err) {
      console.error("Failed to delete chat session:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-indigo-50/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                Saved Chat Conversations
                <span className="text-[11px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                  PostgreSQL
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Browse, switch, or restore your previous assistant conversations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onNewChat();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              New Chat
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Sessions List */}
        <div className="p-6 overflow-y-auto flex-1 divide-y divide-slate-100 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-xs font-medium">Loading saved conversations from PostgreSQL...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 mx-auto flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">No previous chats found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Start typing commands or filling form details and your chat sessions will automatically be stored here in PostgreSQL.
              </p>
              <button
                onClick={() => {
                  onNewChat();
                  onClose();
                }}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Start New Chat
              </button>
            </div>
          ) : (
            sessions.map((s) => {
              const isCurrent = s.thread_id === currentThreadId;
              const isDeleting = deletingId === s.thread_id;

              return (
                <div
                  key={s.thread_id}
                  onClick={() => {
                    onSelectThread(s.thread_id);
                    onClose();
                  }}
                  className={`group pt-2 pb-2 px-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                    isCurrent
                      ? "bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-400/20"
                      : "bg-white hover:bg-slate-50/90 border-slate-200/80 hover:border-indigo-200 shadow-2xs"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        isCurrent
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700"
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {s.title_preview.slice(0, 65)}
                          {s.title_preview.length > 65 ? "..." : ""}
                        </span>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.2 rounded-md">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatTime(s.last_activity)}
                        </span>
                        <span>•</span>
                        <span>{s.message_count} {s.message_count === 1 ? "message" : "messages"}</span>
                        <span className="font-mono text-[10px] text-slate-300">
                          ID: {s.thread_id.slice(-8)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => handleDelete(e, s.thread_id)}
                      disabled={isDeleting}
                      title="Delete chat history"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            Saved conversations persist across page refreshes and server restarts
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
