import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  Edit3,
  Send,
  FileText,
  User,
  Users,
  Briefcase,
  Home,
  CheckSquare,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { FormNode } from "../../types/form";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  formTree: FormNode;
  fieldValues: Record<string, any>;
  onFieldChange: (nodeId: string, value: any) => void;
  onSubmitApplication: () => void;
}

const TAB_ICONS: Record<string, React.ReactNode> = {
  tab_consents: <ShieldCheck className="w-4 h-4 text-indigo-500" />,
  tab_personal_borrower: <User className="w-4 h-4 text-blue-500" />,
  tab_personal_coborrower: <Users className="w-4 h-4 text-emerald-500" />,
  tab_income_borrower: <Briefcase className="w-4 h-4 text-amber-500" />,
  tab_product_loan: <Home className="w-4 h-4 text-purple-500" />,
  tab_decision: <CheckSquare className="w-4 h-4 text-teal-500" />,
};

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  formTree,
  fieldValues,
  onFieldChange,
  onSubmitApplication,
}) => {
  const [activeTabFilter, setActiveTabFilter] = useState<string>("all");
  const [collapsedTabs, setCollapsedTabs] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const tabs = (formTree.children || []).filter((n) => n.node_type === "tab");

  const toggleTabCollapse = (tabId: string) => {
    setCollapsedTabs((prev) => ({
      ...prev,
      [tabId]: !prev[tabId],
    }));
  };

  const renderFieldInput = (field: FormNode) => {
    const value = fieldValues[field.node_id] !== undefined ? fieldValues[field.node_id] : field.value ?? "";
    const isReadonly = field.readonly;

    if (field.field_type === "checkbox") {
      return (
        <label className="flex items-center gap-3 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={isReadonly}
            onChange={(e) => onFieldChange(field.node_id, e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
          />
          <span className="text-xs font-medium text-slate-700">{field.label}</span>
        </label>
      );
    }

    if (field.node_type === "segment" || (field.options && field.options.length <= 3 && field.field_type !== "select")) {
      const options = field.options || ["Yes", "No"];
      return (
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </label>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={isReadonly}
                onClick={() => onFieldChange(field.node_id, opt)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  String(value).toLowerCase() === opt.toLowerCase()
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (field.field_type === "select" && field.options && field.options.length > 0) {
      return (
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {field.label} {field.required && <span className="text-red-500">*</span>}
            {isReadonly && <span className="text-[10px] text-amber-600 ml-1">(Read-only)</span>}
          </label>
          <select
            value={String(value)}
            disabled={isReadonly}
            onChange={(e) => onFieldChange(field.node_id, e.target.value)}
            className={`w-full text-xs rounded-lg px-2.5 py-1.5 border transition-all ${
              isReadonly
                ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-white border-slate-300 text-slate-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            }`}
          >
            <option value="">-- Select {field.label} --</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (field.node_type === "slider") {
      return (
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-slate-700">{field.label}</label>
            <span className="text-xs font-bold text-blue-600">
              {Number(value).toLocaleString()} {field.unit || ""}
            </span>
          </div>
          <input
            type="range"
            min={field.min || 0}
            max={field.max || 1000000}
            step={field.step || 1000}
            value={Number(value) || 0}
            disabled={isReadonly}
            onChange={(e) => onFieldChange(field.node_id, Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
      );
    }

    // Default text, number, date, email input
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {field.label} {field.required && <span className="text-red-500">*</span>}
          {isReadonly && <span className="text-[10px] text-amber-600 ml-1">(Read-only)</span>}
        </label>
        <input
          type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
          value={value ?? ""}
          readOnly={isReadonly}
          placeholder={field.placeholder || `Enter ${field.label}`}
          onChange={(e) => onFieldChange(field.node_id, e.target.value)}
          className={`w-full text-xs rounded-lg px-2.5 py-1.5 border transition-all ${
            isReadonly
              ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
              : "bg-white border-slate-300 text-slate-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
          }`}
        />
      </div>
    );
  };

  const renderSection = (sec: FormNode) => {
    const fields = (sec.children || []).filter(
      (c) => c.node_type === "field" || c.node_type === "segment" || c.node_type === "slider"
    );

    if (fields.length === 0) return null;

    return (
      <div key={sec.node_id} className="mb-4 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
        <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          {sec.label}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {fields.map((f) => (
            <div key={f.node_id} className="space-y-0.5">
              {renderFieldInput(f)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const filteredTabs = activeTabFilter === "all" ? tabs : tabs.filter((t) => t.node_id === activeTabFilter);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#edf4fc] border-b border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  📋 Single-Page Application Review & Edit
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                  Live Two-Way Sync
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Inspect, modify, and verify all details across all 6 tabs in this unified view before submitting.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Filters */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTabFilter("all")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              activeTabFilter === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200"
            }`}
          >
            All Tabs ({tabs.length})
          </button>
          {tabs.map((tab) => (
            <button
              key={tab.node_id}
              onClick={() => setActiveTabFilter(tab.node_id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                activeTabFilter === tab.node_id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200"
              }`}
            >
              {TAB_ICONS[tab.node_id]}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {filteredTabs.map((tab) => {
            const isCollapsed = collapsedTabs[tab.node_id];
            const sections = (tab.children || []).filter((c) => c.node_type === "section");

            return (
              <div
                key={tab.node_id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Tab Banner */}
                <div
                  onClick={() => toggleTabCollapse(tab.node_id)}
                  className="px-4 py-3 bg-[#f5f8fc] border-b border-slate-200/80 flex items-center justify-between cursor-pointer hover:bg-blue-50/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-white shadow-xs border border-slate-200">
                      {TAB_ICONS[tab.node_id] || <FileText className="w-4 h-4 text-slate-600" />}
                    </span>
                    <h3 className="text-sm font-bold text-slate-800">{tab.label}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      {sections.length} Section{sections.length !== 1 ? "s" : ""}
                    </span>
                    {isCollapsed ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Tab Sections */}
                {!isCollapsed && (
                  <div className="p-4 space-y-2">
                    {sections.map(renderSection)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Updates made here sync live with the form and the AI assistant.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-all shadow-xs"
            >
              Close Review
            </button>
            <button
              onClick={() => {
                onSubmitApplication();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirm & Submit Application
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
