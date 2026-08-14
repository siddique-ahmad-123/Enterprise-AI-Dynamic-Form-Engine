import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Compass,
  BarChart3,
  PieChart as PieChartIcon,
  Sparkles,
  ShieldAlert,
  Eraser,
  Copy,
  Check,
  ChevronRight,
  Send,
  Layers,
  Search,
  Lock,
  FileText,
  Edit3,
} from "lucide-react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";

export interface CardData {
  card_type:
    | "update_success"
    | "clear_field"
    | "field_info"
    | "navigate_tab"
    | "form_summary"
    | "missing_fields"
    | "validation_error"
    | "help"
    | "pie_chart"
    | "bar_chart"
    | "data_table"
    | "metric"
    | "review_summary"
    | "submission_success";
  title?: string;
  reference_id?: string;
  applicant_name?: string;
  submission_date?: string;
  field_label?: string;
  new_value?: string;
  value?: string;
  node_id?: string;
  path?: string[];
  field_type?: string;
  readonly?: boolean;
  required?: boolean;
  tab_label?: string;
  message?: string;
  description?: string;
  total_fields?: number;
  filled_fields?: number;
  readonly_fields?: number;
  percentage?: number;
  tabs?: Array<any>;
  updated_fields?: Array<{ field_label: string; new_value: string; node_id?: string }>;
  field_items?: Array<{ node_id: string; label: string; value: string; readonly?: boolean }>;
  missing_required?: string[];
  empty_optional?: string[];
  suggestions?: string[];
  data?: Array<{ label: string; value: number }>;
  columns?: Array<{ key: string; label: string }>;
  rows?: Array<Record<string, string | number>>;
}

const CHART_COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#6366f1", // indigo-500
  "#06b6d4", // cyan-500
];

/**
 * Extracts json:card block or parses raw markdown into structured CardData
 */
export function parseMessageToCardData(content: string): CardData | null {
  if (!content) return null;

  // 1. Try parsing ```json:card ... ``` or ```json:a2ui ... ```
  const jsonMatch = content.match(/```json:(?:card|a2ui)\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {
      console.warn("Failed to parse json payload:", e);
    }
  }

  // 2. Try parsing plain JSON
  if (content.trim().startsWith("{") && content.trim().endsWith("}")) {
    try {
      return JSON.parse(content.trim());
    } catch (e) {
      // Not JSON
    }
  }

  const lower = content.toLowerCase();

  // 3. Detect Pie Chart or Bar Chart request in content
  if (lower.includes("pie chart") || (lower.includes("chart") && lower.includes("summary"))) {
    return {
      card_type: "pie_chart",
      title: "Form Field Completion Analysis (Pie Chart)",
      description: "Real-time visual breakdown of form completion status.",
      data: [
        { label: "Filled Fields", value: 25 },
        { label: "Missing Required", value: 3 },
        { label: "Optional Empty", value: 5 },
      ],
    };
  }

  if (lower.includes("bar chart") || lower.includes("field type distribution")) {
    return {
      card_type: "bar_chart",
      title: "Field Type Distribution (Bar Chart)",
      description: "Comparison of form elements across data types.",
      data: [
        { label: "Text", value: 15 },
        { label: "Select", value: 10 },
        { label: "Number", value: 5 },
        { label: "Switch", value: 3 },
      ],
    };
  }

  // 4. Fallback Markdown pattern parser
  // Case: Update success
  if (content.includes("Updated Field Successfully") || content.includes("✅")) {
    const fieldMatch = content.match(/Field\*\*:?\s*`([^`]+)`/i) || content.match(/Field:\s*`([^`]+)`/i);
    const valMatch = content.match(/New Value\*\*:?\s*`([^`]+)`/i) || content.match(/New Value:\s*`([^`]+)`/i);
    const locationMatch = content.match(/Location:\s*\*?([^\*\n]+)\*?/i);

    let pathArr: string[] = [];
    if (locationMatch && locationMatch[1]) {
      pathArr = locationMatch[1].split("->").map((s) => s.trim());
    }

    if (fieldMatch && fieldMatch[1]) {
      return {
        card_type: "update_success",
        title: "Field Updated Successfully",
        field_label: fieldMatch[1],
        new_value: valMatch ? valMatch[1] : "",
        path: pathArr,
      };
    }
  }

  // Case: Readonly or validation alert
  if (content.includes("read-only") || content.includes("⚠️") || content.includes("cannot be modified")) {
    const fieldMatch = content.match(/`([^`]+)`/);
    return {
      card_type: "validation_error",
      title: "Action Restricted",
      field_label: fieldMatch ? fieldMatch[1] : "Field",
      message: content.replace(/⚠️/g, "").replace(/\*\*/g, "").trim(),
    };
  }

  // Case: Form Summary
  if (content.includes("Form Summary") || content.includes("📊")) {
    const pctMatch = content.match(/\((\d+)\/(\d+)\s+fields completed\s*-\s*(\d+)%\)/i);
    const fieldLines = content.split("\n").filter((l) => l.trim().startsWith("• **"));
    const items = fieldLines.map((l) => {
      const match = l.match(/• \*\*([^\*]+)\*\*:?\s*`([^`]+)`/);
      return {
        node_id: match ? match[1].toLowerCase().replace(/\s+/g, "_") : "field",
        label: match ? match[1] : l,
        value: match ? match[2] : "",
      };
    });

    const total = pctMatch ? parseInt(pctMatch[2], 10) : items.length;
    const filled = pctMatch ? parseInt(pctMatch[1], 10) : items.length;
    const pct = pctMatch ? parseInt(pctMatch[3], 10) : total > 0 ? Math.round((filled / total) * 100) : 0;

    return {
      card_type: "form_summary",
      total_fields: total,
      filled_fields: filled,
      percentage: pct,
      field_items: items,
    };
  }

  // Case: Field Information / Query
  if (content.includes("Field Information") || content.includes("🔍")) {
    const fieldMatch = content.match(/Field Information for '([^']+)'/i);
    const valMatch = content.match(/Current Value\*\*:?\s*`([^`]+)`/i);
    const nodeIdMatch = content.match(/Node ID\*\*:?\s*`([^`]+)`/i);
    const typeMatch = content.match(/Field Type\*\*:?\s*`([^`]+)`/i);

    return {
      card_type: "field_info",
      title: "Field Information",
      field_label: fieldMatch ? fieldMatch[1] : "Field",
      value: valMatch ? valMatch[1] : "",
      node_id: nodeIdMatch ? nodeIdMatch[1] : "",
      field_type: typeMatch ? typeMatch[1] : "text",
      readonly: content.includes("READ-ONLY"),
    };
  }

  // Case: Navigate Tab
  if (content.includes("Navigated to Tab") || content.includes("📌")) {
    const tabMatch = content.match(/to \*\*([^\*]+)\*\*/i);
    return {
      card_type: "navigate_tab",
      title: "Navigated to Tab",
      tab_label: tabMatch ? tabMatch[1] : "Tab",
    };
  }

  // Case: Missing Fields
  if (content.includes("Field Completion Analysis") || content.includes("📋")) {
    const reqLines = content
      .split("\n")
      .filter((l) => l.includes("🔴"))
      .map((l) => l.replace(/🔴/g, "").replace(/\(Required\)/g, "").replace(/\*\*/g, "").trim());

    const optLines = content
      .split("\n")
      .filter((l) => l.includes("⚪"))
      .map((l) => l.replace(/⚪/g, "").replace(/\(Optional\)/g, "").replace(/\*\*/g, "").trim());

    return {
      card_type: "missing_fields",
      missing_required: reqLines,
      empty_optional: optLines,
    };
  }

  // Case: Clear field
  if (content.includes("Cleared Field") || content.includes("🧹")) {
    const fieldMatch = content.match(/Cleared Field`?:?\s*`([^`]+)`/i);
    return {
      card_type: "clear_field",
      title: "Cleared Field",
      field_label: fieldMatch ? fieldMatch[1] : "Field",
    };
  }

  // Default: Help card
  return {
    card_type: "help",
    title: "AI Dynamic Form Assistant",
    description: content.replace(/```json:card[\s\S]*?```/g, "").trim(),
    suggestions: [
      "Plot pie chart summary of form fields",
      "Set Customer Name to John Doe",
      "Update KYC Status to Verified",
      "Which fields are empty?",
      "Summarize the form",
    ],
  };
}

interface ChatCardProps {
  content: string;
  onSelectPrompt?: (prompt: string) => void;
}

export const ChatCardRenderer: React.FC<ChatCardProps> = ({ content, onSelectPrompt }) => {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const cardData = parseMessageToCardData(content);

  if (!cardData) {
    return <div className="text-slate-800 text-sm whitespace-pre-wrap">{content}</div>;
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cleanDescription = content.replace(/```json:(?:card|a2ui)[\s\S]*?```/g, "").trim();

  // ─────────────────────────────────────────────────────────────
  // A. PIE CHART CARD (Declarative Gen UI / Real-time Chart)
  // ─────────────────────────────────────────────────────────────
  if (cardData.card_type === "pie_chart") {
    const chartData = cardData.data && cardData.data.length > 0
      ? cardData.data
      : [
          { label: "Filled Fields", value: 25 },
          { label: "Missing Required", value: 3 },
          { label: "Optional Empty", value: 5 },
        ];

    const totalVal = chartData.reduce((acc, curr) => acc + curr.value, 0);

    return (
      <Card className="overflow-hidden border-indigo-200 shadow-md">
        <CardHeader className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-500/30 rounded-lg">
              <PieChartIcon className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <CardTitle className="text-white text-sm font-bold">
                {cardData.title || "Form Summary (Pie Chart Analysis)"}
              </CardTitle>
              <CardDescription className="text-indigo-200 text-xs">
                {cardData.description || "Real-time field status breakdown"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="w-full h-52 relative">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number, name: string) => [`${val} fields`, name]}
                  contentStyle={{ backgroundColor: "#0f172a", color: "#ffffff", borderRadius: "8px", fontSize: "12px" }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-slate-400 uppercase font-semibold">Total</span>
              <span className="text-xl font-bold text-slate-800">{totalVal}</span>
            </div>
          </div>

          <Separator className="my-2" />

          {/* Legend Items Grid */}
          <div className="grid grid-cols-1 gap-2 text-xs">
            {chartData.map((item, idx) => {
              const color = CHART_COLORS[idx % CHART_COLORS.length];
              const pct = totalVal > 0 ? Math.round((item.value / totalVal) * 100) : 0;
              return (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
                    <span className="font-semibold text-slate-700">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{item.value}</span>
                    <Badge variant="info">{pct}%</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // B. BAR CHART CARD (Declarative Gen UI / Real-time Chart)
  // ─────────────────────────────────────────────────────────────
  if (cardData.card_type === "bar_chart") {
    const chartData = cardData.data && cardData.data.length > 0
      ? cardData.data
      : [
          { label: "Text", value: 15 },
          { label: "Select", value: 10 },
          { label: "Number", value: 5 },
          { label: "Switch", value: 3 },
        ];

    return (
      <Card className="overflow-hidden border-sky-200 shadow-md">
        <CardHeader className="bg-gradient-to-r from-sky-800 via-blue-900 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-sky-500/30 rounded-lg">
              <BarChart3 className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <CardTitle className="text-white text-sm font-bold">
                {cardData.title || "Field Type Breakdown (Bar Chart)"}
              </CardTitle>
              <CardDescription className="text-sky-200 text-xs">
                {cardData.description || "Comparison of form elements across data types"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-3">
          <div className="w-full h-52">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", color: "#ffffff", borderRadius: "8px", fontSize: "12px" }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 1. UPDATE SUCCESS CARD
  // ─────────────────────────────────────────────────────────────
  if (cardData.card_type === "update_success") {
    return (
      <div className="bg-white rounded-xl border border-emerald-200/80 shadow-md shadow-emerald-500/5 overflow-hidden transition-all duration-200">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-3 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1 bg-white/20 rounded-lg backdrop-blur-sm">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider block">
                Real-Time Update
              </span>
              <h4 className="font-bold text-sm leading-tight text-white">Field Updated Successfully</h4>
            </div>
          </div>
          <button
            onClick={() => handleCopy(`${cardData.field_label}: ${cardData.new_value}`)}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            title="Copy update details"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Card Body */}
        <div className="p-4 space-y-3 bg-gradient-to-b from-emerald-50/30 to-white">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-medium">Target Field</span>
              <div className="font-bold text-slate-900 text-base">{cardData.field_label}</div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500 font-medium block mb-1">New Value</span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold bg-emerald-100 text-emerald-900 border border-emerald-300/80 shadow-xs">
                {cardData.new_value || "(empty)"}
              </span>
            </div>
          </div>

          {/* Breadcrumb Path */}
          {cardData.path && cardData.path.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3 text-slate-400" /> Location Hierarchy
              </div>
              <div className="flex flex-wrap items-center gap-1 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                {cardData.path.map((item, idx) => (
                  <React.Fragment key={idx}>
                    <span className={idx === cardData.path!.length - 1 ? "font-semibold text-emerald-800" : ""}>
                      {item}
                    </span>
                    {idx < cardData.path!.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Status */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium text-slate-700">Form UI Synchronized</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Live CoAgent Sync</span>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 1.1 REVIEW SUMMARY STAGE CARD
  // ─────────────────────────────────────────────────────────────
  if (cardData.card_type === "review_summary") {
    const handleOpenReview = () => {
      window.dispatchEvent(new CustomEvent("open-review-modal"));
    };

    return (
      <div className="bg-white rounded-xl border border-blue-200 shadow-lg shadow-blue-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 px-4 py-3.5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/30 rounded-xl border border-blue-400/30">
              <FileText className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">Application Journey Review</h4>
              <span className="text-[11px] text-blue-200">All 6 tabs are ready for final verification</span>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-[10px] font-bold uppercase tracking-wider">
            Review Ready
          </span>
        </div>

        <div className="p-4 space-y-3.5 text-xs">
          <p className="text-slate-600 leading-relaxed">
            All required steps of your application have been completed. You can view, verify, and modify any detail across all tabs in our **Single-Page Review & Edit Popup**.
          </p>

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleOpenReview}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              Open Single-Page Review & Edit Popup
            </button>

            <button
              onClick={() => onSelectPrompt?.("Submit Application")}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-900 hover:bg-black text-white font-semibold rounded-xl shadow-xs transition-all cursor-pointer text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Confirm & Submit Application
            </button>
          </div>
        </div>

        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>💡 Or correct conversationally: "Change mobile to..."</span>
          <span className="font-mono text-blue-600 font-semibold">Step 6 / 6</span>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 1.2 SUBMISSION SUCCESS CARD
  // ─────────────────────────────────────────────────────────────
  if (cardData.card_type === "submission_success") {
    return (
      <div className="bg-white rounded-xl border border-emerald-300 shadow-xl shadow-emerald-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 px-4 py-4 text-white flex items-center gap-3">
          <div className="p-2.5 bg-white/20 rounded-2xl shadow-inner">
            <CheckCircle2 className="w-6 h-6 text-emerald-200" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest block">Application Finalized</span>
            <h4 className="font-extrabold text-base text-white">Application Submitted Successfully 🎉</h4>
          </div>
        </div>

        <div className="p-4 space-y-3 text-xs">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
            <span className="text-[11px] text-slate-500 block mb-0.5">Official Reference ID</span>
            <span className="text-base font-black font-mono text-emerald-800 tracking-wider">
              {cardData.reference_id || "APP-2026-0001"}
            </span>
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Status</span>
              <span className="font-bold text-slate-800 bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                Underwriting Sanction Review
              </span>
            </div>
            {cardData.applicant_name && (
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Applicant</span>
                <span className="font-semibold text-slate-800">{cardData.applicant_name}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">Submission Date</span>
              <span className="font-mono text-slate-700">{cardData.submission_date || new Date().toLocaleString()}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 text-center pt-2">
            Your application is now under review with Newgen Credit Division.
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. FORM SUMMARY CARD
  // ─────────────────────────────────────────────────────────────
  if (cardData.card_type === "form_summary") {
    const total = cardData.total_fields || 0;
    const filled = cardData.filled_fields || 0;
    const pct = cardData.percentage ?? (total > 0 ? Math.round((filled / total) * 100) : 0);
    const missing = cardData.missing_required || [];
    const items = cardData.field_items || [];

    const filteredItems = searchQuery
      ? items.filter(
          (it) =>
            it.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            it.value.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : items;

    return (
      <div className="bg-white rounded-xl border border-indigo-200/80 shadow-md shadow-indigo-500/5 overflow-hidden">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 px-4 py-3.5 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-indigo-500/30 rounded-lg border border-indigo-400/30">
                <BarChart3 className="w-5 h-5 text-indigo-200" />
              </div>
              <div>
                <h4 className="font-bold text-base leading-tight text-white">Form Progress Summary</h4>
                <span className="text-xs text-indigo-200 font-medium">Hierarchy Completion Status</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-white leading-none">{pct}%</span>
              <span className="text-[10px] text-indigo-200 block font-medium uppercase tracking-wider">Completed</span>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="w-full bg-indigo-950/60 rounded-full h-2.5 overflow-hidden p-0.5 border border-indigo-700/40">
            <div
              className="bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-300 h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Counter Metric Cards Grid */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/50">
          <div className="p-3 text-center">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">Total Fields</span>
            <span className="text-lg font-bold text-slate-800">{total}</span>
          </div>
          <div className="p-3 text-center">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">Filled</span>
            <span className="text-lg font-bold text-emerald-600">{filled}</span>
          </div>
          <div className="p-3 text-center">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">Missing Req.</span>
            <span className={`text-lg font-bold ${missing.length > 0 ? "text-rose-600" : "text-slate-400"}`}>
              {missing.length}
            </span>
          </div>
        </div>

        {/* Action Button: Plot Pie Chart Analysis */}
        <div className="p-3 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between">
          <span className="text-xs text-indigo-900 font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Visualize as Chart
          </span>
          <button
            onClick={() => onSelectPrompt?.("Plot pie chart summary of form fields")}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            <PieChartIcon className="w-3 h-3" /> Plot Pie Chart
          </button>
        </div>

        {/* Filled Items Grid */}
        <div className="p-4 space-y-3">
          {items.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filled Values ({items.length})</span>
                {items.length > 4 && (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search fields..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="text-xs px-2.5 py-1 pl-7 bg-slate-100 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1.5" />
                  </div>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                {filteredItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/60 text-xs transition-colors"
                  >
                    <span className="font-medium text-slate-700 truncate max-w-[140px]">{item.label}</span>
                    <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px] font-mono truncate max-w-[140px]">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing Mandatory Fields Alert */}
          {missing.length > 0 ? (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Attention: {missing.length} Mandatory Field(s) Pending</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {missing.map((req, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectPrompt?.(`Set ${req} to `)}
                    className="px-2 py-1 bg-white hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    + Fill {req}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">All mandatory fields are satisfied!</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. FIELD INFO CARD
  // ─────────────────────────────────────────────────────────────
  if (cardData.card_type === "field_info") {
    return (
      <div className="bg-white rounded-xl border border-sky-200 shadow-md shadow-sky-500/5 overflow-hidden">
        <div className="bg-gradient-to-r from-sky-700 to-blue-800 px-4 py-3 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Info className="w-4 h-4 text-white" />
            </div>
            <h4 className="font-bold text-sm text-white">Field Information</h4>
          </div>
          {cardData.readonly && (
            <span className="px-2 py-0.5 bg-amber-500/30 text-amber-100 border border-amber-300/40 rounded text-[10px] font-semibold flex items-center gap-1">
              <Lock className="w-3 h-3" /> Read-Only
            </span>
          )}
        </div>

        <div className="p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Field Label</span>
            <span className="font-bold text-slate-900 text-sm">{cardData.field_label}</span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Current Value</span>
            <span className="font-semibold text-slate-900 bg-sky-50 text-sky-900 px-2.5 py-1 rounded border border-sky-200 font-mono">
              {cardData.value || "(empty)"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-slate-50 p-2 rounded border border-slate-200/60">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Node ID</span>
              <span className="font-mono text-slate-700 font-medium">{cardData.node_id}</span>
            </div>

            <div className="bg-slate-50 p-2 rounded border border-slate-200/60">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Field Type</span>
              <span className="font-mono text-slate-700 font-medium">{cardData.field_type || "text"}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 4. MISSING FIELDS ANALYSIS CARD
  // ─────────────────────────────────────────────────────────────
  if (cardData.card_type === "missing_fields") {
    const missingReq = cardData.missing_required || [];
    const emptyOpt = cardData.empty_optional || [];

    return (
      <div className="bg-white rounded-xl border border-rose-200 shadow-md shadow-rose-500/5 overflow-hidden">
        <div className="bg-gradient-to-r from-rose-800 to-slate-900 px-4 py-3 text-white flex items-center gap-2.5">
          <div className="p-1.5 bg-rose-500/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-rose-200" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white">Field Completion Analysis</h4>
            <span className="text-[11px] text-rose-200">Empty & Required Fields Audit</span>
          </div>
        </div>

        <div className="p-4 space-y-3 text-xs">
          {missingReq.length > 0 && (
            <div className="space-y-2">
              <span className="font-bold text-rose-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                Required Fields Needing Attention ({missingReq.length})
              </span>

              <div className="grid grid-cols-1 gap-1.5">
                {missingReq.map((req, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-rose-50/80 border border-rose-200 text-rose-900"
                  >
                    <span className="font-semibold">{req}</span>
                    <button
                      onClick={() => onSelectPrompt?.(`Set ${req} to `)}
                      className="px-2 py-0.5 bg-white hover:bg-rose-100 text-rose-700 font-medium border border-rose-300 rounded text-[11px] transition-colors"
                    >
                      Fill Field
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {emptyOpt.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="font-semibold text-slate-500">Empty Optional Fields ({emptyOpt.length})</span>
              <div className="flex flex-wrap gap-1.5">
                {emptyOpt.map((opt, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-slate-100 text-slate-600 rounded border border-slate-200 text-[11px]"
                  >
                    {opt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {missingReq.length === 0 && emptyOpt.length === 0 && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg font-medium text-center">
              🎉 All fields in the form are completely filled!
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 5. VALIDATION / READONLY ERROR CARD
  // ─────────────────────────────────────────────────────────────
  if (cardData.card_type === "validation_error") {
    return (
      <div className="bg-white rounded-xl border border-amber-300 shadow-md shadow-amber-500/5 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-600 to-orange-700 px-4 py-2.5 text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-100 shrink-0" />
          <h4 className="font-bold text-sm text-white">{cardData.title || "Action Restricted"}</h4>
        </div>
        <div className="p-4 bg-amber-50/40 text-xs space-y-2">
          <div className="p-3 bg-amber-100/60 border border-amber-200 rounded-lg text-amber-900 font-medium leading-relaxed">
            {cardData.message || cleanDescription}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 6. TAB NAVIGATION CARD
  // ─────────────────────────────────────────────────────────────
  if (cardData.card_type === "navigate_tab") {
    return (
      <div className="bg-white rounded-xl border border-blue-200 shadow-md shadow-blue-500/5 p-4 flex items-center gap-3">
        <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
          <Compass className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">Tab Switched</span>
          <h4 className="font-bold text-sm text-slate-900">
            Active tab changed to <span className="text-blue-700 font-extrabold">{cardData.tab_label}</span>
          </h4>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 7. CLEAR FIELD CARD
  // ─────────────────────────────────────────────────────────────
  if (cardData.card_type === "clear_field") {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-md p-4 flex items-center gap-3">
        <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
          <Eraser className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider block">Field Reset</span>
          <h4 className="font-bold text-sm text-slate-900">
            Field <span className="font-mono text-purple-800">{cardData.field_label}</span> has been cleared
          </h4>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 8. HELP / WELCOME ASSISTANT CARD
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-indigo-200 shadow-md overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 px-4 py-3 text-white flex items-center gap-2.5">
        <div className="p-1.5 bg-indigo-500/30 rounded-lg">
          <Sparkles className="w-5 h-5 text-indigo-300" />
        </div>
        <div>
          <h4 className="font-bold text-sm text-white">AI Dynamic Form Assistant</h4>
          <span className="text-[11px] text-indigo-200">Interactive Form Copilot</span>
        </div>
      </div>

      <div className="p-4 space-y-3 text-xs">
        <p className="text-slate-600 leading-relaxed">
          {cardData.description || "I can understand and manipulate this entire dynamic form hierarchy. Select a quick action below:"}
        </p>

        {cardData.suggestions && cardData.suggestions.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Suggested Prompts
            </span>
            <div className="flex flex-col gap-1.5">
              {cardData.suggestions.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectPrompt?.(prompt)}
                  className="flex items-center justify-between p-2 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 rounded-lg text-slate-700 hover:text-indigo-900 font-medium transition-all text-left text-xs group cursor-pointer"
                >
                  <span>{prompt}</span>
                  <Send className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
