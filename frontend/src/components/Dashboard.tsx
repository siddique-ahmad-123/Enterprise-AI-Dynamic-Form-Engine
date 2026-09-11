import React, { useState, useEffect } from "react";
import {
  FileText,
  PlusCircle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Eye,
  LogOut,
  RefreshCw,
  Building2,
  DollarSign,
  User,
  Calendar,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Copy,
  Check,
  Search,
} from "lucide-react";

export interface ApplicationItem {
  thread_id: string;
  username: string;
  is_submitted: boolean;
  submission_ref: string | null;
  submitted_at: string | null;
  created_at: string | null;
  last_activity: string | null;
  status: string;
  borrower_name: string;
  loan_amount: number | string | null;
  loan_type: string;
  property_address: string;
  message_count: number;
  filled_fields_count: number;
}

export interface DashboardStats {
  total: number;
  submitted: number;
  in_progress: number;
}

interface DashboardProps {
  authUser: string | null;
  onLogout: () => void;
  onStartNewApplication: () => void;
  onSelectApplication: (threadId: string, isSubmitted: boolean, submissionRef?: string | null) => void;
  backendUrl?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({
  authUser,
  onLogout,
  onStartNewApplication,
  onSelectApplication,
  backendUrl = "http://localhost:8000",
}) => {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ total: 0, submitted: 0, in_progress: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [isStartingNew, setIsStartingNew] = useState<boolean>(false);
  const [filter, setFilter] = useState<"all" | "submitted" | "in_progress">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const fetchApplications = async () => {
    if (!authUser) return;
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/applications/user/${encodeURIComponent(authUser)}`);
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
        setStats(data.stats || { total: 0, submitted: 0, in_progress: 0 });
      }
    } catch (e) {
      console.error("Failed to load user applications:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const handleStartNew = async () => {
    setIsStartingNew(true);
    try {
      await onStartNewApplication();
    } finally {
      setIsStartingNew(false);
    }
  };

  const handleCopyRef = (ref: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ref);
    setCopiedRef(ref);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const formatCurrency = (val: any) => {
    if (!val) return "Not Specified";
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
    if (isNaN(num)) return String(val);
    return `AED ${num.toLocaleString("en-US")}`;
  };

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return "N/A";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const filteredApplications = applications.filter((app) => {
    if (filter === "submitted" && !app.is_submitted) return false;
    if (filter === "in_progress" && app.is_submitted) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = app.submission_ref?.toLowerCase().includes(q);
      const matchName = app.borrower_name?.toLowerCase().includes(q);
      const matchType = app.loan_type?.toLowerCase().includes(q);
      const matchProp = app.property_address?.toLowerCase().includes(q);
      const matchThread = app.thread_id?.toLowerCase().includes(q);
      return matchRef || matchName || matchType || matchProp || matchThread;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/40 text-slate-900 font-sans antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Portal Title */}
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#1e295d" strokeWidth="6" />
                <path d="M 25 50 Q 50 20 75 50" fill="none" stroke="#f97316" strokeWidth="6" strokeLinecap="round" />
                <circle cx="70" cy="30" r="6" fill="#f97316" />
                <circle cx="30" cy="70" r="5" fill="#1e295d" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-[#1e295d]">newgen</span>
                <span className="text-slate-300 font-light">|</span>
                <span className="text-sm font-bold text-slate-700 tracking-wide uppercase">
                  UAE Mortgage Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                AI-Powered Dynamic Origination & Underwriting Engine
              </p>
            </div>
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200 text-xs font-semibold text-slate-700">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#1e295d] to-indigo-600 text-white flex items-center justify-center text-[11px] font-bold">
                {authUser ? authUser.slice(0, 2).toUpperCase() : "U"}
              </div>
              <span className="font-bold text-slate-800">{authUser || "User"}</span>
            </div>

            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-lg transition-all shadow-sm active:scale-95"
              title="Log Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1e295d] via-[#243572] to-indigo-900 text-white p-6 sm:p-8 shadow-xl border border-indigo-950/20">
          {/* Background Decorative Graphic */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none hidden md:block">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              <circle cx="100" cy="100" r="80" fill="none" stroke="white" strokeWidth="8" />
              <circle cx="100" cy="100" r="50" fill="none" stroke="white" strokeWidth="4" />
              <circle cx="100" cy="100" r="20" fill="white" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-xs font-semibold text-amber-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI-Assisted UAE Mortgage Application Management</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Welcome back, <span className="text-amber-400 capitalize">{authUser || "Borrower"}</span>!
              </h1>
              <p className="text-sm text-slate-200 leading-relaxed">
                Track your active mortgage applications, review approved credit underwriting terms, or launch a new financing journey with conversational AI assistance.
              </p>
            </div>

            {/* Prominent CTA */}
            <div className="shrink-0 flex items-center gap-3">
              <button
                onClick={handleStartNew}
                disabled={isStartingNew}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:opacity-50"
              >
                {isStartingNew ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <PlusCircle className="w-5 h-5" />
                )}
                <span>Start New Application</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Total Applications */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-100">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Applications
              </p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{stats.total}</p>
            </div>
          </div>

          {/* Submitted / Underwriting */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Submitted & Underwriting
              </p>
              <p className="text-2xl font-black text-blue-700 mt-0.5">{stats.submitted}</p>
            </div>
          </div>

          {/* In Progress */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                In Progress / Drafts
              </p>
              <p className="text-2xl font-black text-amber-600 mt-0.5">{stats.in_progress}</p>
            </div>
          </div>

          {/* Pre-Approved Status */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Pre-Approved Credit
              </p>
              <p className="text-2xl font-black text-emerald-700 mt-0.5">
                {applications.filter((a) => a.status.toLowerCase().includes("approved")).length}
              </p>
            </div>
          </div>
        </div>

        {/* Application History Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6 sm:p-8">
          {/* Section Header & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <span>Application Journey History</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                All submitted and draft mortgage applications for your account.
              </p>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search applications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 placeholder-slate-400 w-48 transition-all"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    filter === "all" ? "bg-white text-indigo-900 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All ({applications.length})
                </button>
                <button
                  onClick={() => setFilter("submitted")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    filter === "submitted" ? "bg-white text-blue-900 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Submitted ({stats.submitted})
                </button>
                <button
                  onClick={() => setFilter("in_progress")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    filter === "in_progress" ? "bg-white text-amber-900 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Drafts ({stats.in_progress})
                </button>
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchApplications}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                title="Refresh applications"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
              </button>
            </div>
          </div>

          {/* Applications List */}
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-600">Loading your mortgage applications...</p>
            </div>
          ) : filteredApplications.length === 0 ? (
            /* Empty State */
            <div className="py-12 text-center max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100">
                <FileText className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">No applications found</h3>
                <p className="text-xs text-slate-500">
                  {searchQuery
                    ? "No mortgage applications match your search query."
                    : "You haven't submitted any applications yet. Begin your mortgage journey now!"}
                </p>
              </div>
              <button
                onClick={handleStartNew}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1e295d] hover:bg-[#151e45] text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Start Application</span>
              </button>
            </div>
          ) : (
            /* Application Cards Grid */
            <div className="space-y-3.5">
              {filteredApplications.map((app) => {
                const isPreApproved = app.status.toLowerCase().includes("approved");
                const isUnderwriting = app.is_submitted && !isPreApproved;

                return (
                  <div
                    key={app.thread_id}
                    onClick={() =>
                      onSelectApplication(app.thread_id, app.is_submitted, app.submission_ref)
                    }
                    className="group relative bg-white border border-slate-200/90 hover:border-indigo-400 rounded-xl p-4 sm:p-5 transition-all duration-200 hover:shadow-md cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    {/* Left: Metadata & Status */}
                    <div className="space-y-3 flex-1">
                      {/* Top badges row */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {/* Reference / Draft Badge */}
                        {app.submission_ref ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-md font-mono font-bold text-[11px]">
                            <span>{app.submission_ref}</span>
                            <button
                              onClick={(e) => handleCopyRef(app.submission_ref!, e)}
                              className="text-indigo-500 hover:text-indigo-800"
                              title="Copy Reference"
                            >
                              {copiedRef === app.submission_ref ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-md font-mono font-bold text-[11px]">
                            DRAFT JOURNEY
                          </span>
                        )}

                        {/* Status Badge */}
                        {isPreApproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded-full text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            {app.status}
                          </span>
                        ) : isUnderwriting ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 font-bold rounded-full text-[11px]">
                            <ShieldCheck className="w-3 h-3" />
                            {app.status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 font-bold rounded-full text-[11px]">
                            <Clock className="w-3 h-3" />
                            In Progress ({app.filled_fields_count} fields filled)
                          </span>
                        )}

                        {/* Timestamp */}
                        <span className="text-slate-400 text-[11px] flex items-center gap-1 ml-auto lg:ml-0">
                          <Calendar className="w-3 h-3" />
                          {app.submitted_at
                            ? `Submitted: ${formatDate(app.submitted_at)}`
                            : `Updated: ${formatDate(app.last_activity || app.created_at)}`}
                        </span>
                      </div>

                      {/* Main Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                        <div>
                          <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" /> Borrower
                          </p>
                          <p className="font-bold text-slate-900 mt-0.5 truncate">
                            {app.borrower_name}
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-slate-400" /> Loan Amount
                          </p>
                          <p className="font-bold text-indigo-900 mt-0.5">
                            {formatCurrency(app.loan_amount)}
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
                            <FileText className="w-3 h-3 text-slate-400" /> Product Type
                          </p>
                          <p className="font-semibold text-slate-700 mt-0.5 truncate">
                            {app.loan_type}
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400" /> Property
                          </p>
                          <p className="font-semibold text-slate-700 mt-0.5 truncate">
                            {app.property_address}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right: Action Button */}
                    <div className="shrink-0 flex items-center lg:border-l lg:border-slate-100 lg:pl-5 pt-2 lg:pt-0">
                      {app.is_submitted ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectApplication(app.thread_id, true, app.submission_ref);
                          }}
                          className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-900 font-bold text-xs rounded-lg border border-indigo-200 transition-all shadow-sm group-hover:bg-[#1e295d] group-hover:text-white group-hover:border-[#1e295d]"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Application</span>
                          <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectApplication(app.thread_id, false, null);
                          }}
                          className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-sm transition-all group-hover:bg-amber-400"
                        >
                          <span>Continue Application</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
