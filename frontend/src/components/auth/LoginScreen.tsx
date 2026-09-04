import React, { useState } from "react";
import { Sparkles, LogIn, UserPlus, Eye, EyeOff, AlertCircle, Loader2, Zap } from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";  // empty = same-origin (Vite proxy in dev)

interface LoginScreenProps {
  onAuthenticated: (username: string, token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!username.trim() || !password) return;

    setLoading(true);
    const endpoint = mode === "login" ? "/auth/login" : "/auth/register";

    try {
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Something went wrong.");
        return;
      }

      if (mode === "register") {
        setSuccessMsg("Account created! You can now log in.");
        setMode("login");
        setPassword("");
        return;
      }

      // login success
      onAuthenticated(data.username, data.access_token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Could not reach the server (${msg}). Is the backend running on port 8000?`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / branding */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="p-3 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              Newgen AI Loan Portal
            </h1>
            <p className="text-sm text-indigo-300 mt-0.5">Enterprise Dynamic Form Engine</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5">
          {/* Mode toggle */}
          <div className="flex rounded-xl overflow-hidden border border-white/10 bg-white/5">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); setSuccessMsg(null); }}
                className={`flex-1 py-2 text-xs font-bold transition-all ${
                  mode === m
                    ? "bg-indigo-600 text-white shadow-inner"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Demo credentials shortcut */}
            {mode === "login" && (
              <button
                type="button"
                onClick={() => { setUsername("demo"); setPassword("demo123"); setError(null); }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                Use Demo Account (demo / demo123)
              </button>
            )}
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={50}
                placeholder="Enter username"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Enter password"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === "register" && (
                <p className="text-[11px] text-slate-500 mt-1">Minimum 6 characters.</p>
              )}
            </div>

            {/* Error / success messages */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
                {successMsg}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === "login" ? (
                <LogIn className="w-4 h-4" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-6">
          Newgen Software Technologies · Secure Enterprise Portal
        </p>
      </div>
    </div>
  );
};
