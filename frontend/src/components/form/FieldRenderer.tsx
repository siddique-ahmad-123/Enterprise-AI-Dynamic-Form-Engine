import React from "react";
import { Lock, Sparkles, HelpCircle, Star, ChevronDown } from "lucide-react";
import { FormNode } from "../../types/form";

interface FieldRendererProps {
  node: FormNode;
  value: any;
  onChange: (nodeId: string, value: any) => void;
  isSelected?: boolean;
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({
  node,
  value,
  onChange,
  isSelected = false,
}) => {
  const {
    node_id,
    node_type,
    label,
    field_type = "text",
    readonly = false,
    required = false,
    options = [],
    placeholder,
    description,
  } = node;

  const currentValue = value !== undefined && value !== null ? value : "";

  // Action Button Nodes (e.g. "Search Customer", "Upload Applicant Form", "Send Consent E-mail")
  if (node_type === "action_button") {
    return (
      <div className="pt-4">
        <button
          type="button"
          onClick={() => onChange(node_id, true)}
          className="bg-[#1e295d] hover:bg-[#151e45] text-white font-semibold text-xs px-6 py-2.5 rounded-lg shadow-sm transition-all duration-200 focus:outline-none"
        >
          {label}
        </button>
      </div>
    );
  }

  const handleChange = (e: any) => {
    if (readonly) return;
    let newVal: any = e.target ? e.target.value : e;
    if (field_type === "switch" || field_type === "checkbox") {
      newVal = e.target.checked;
    }
    onChange(node_id, newVal);
  };

  // Checkbox Consent Statements (spans full row)
  if (field_type === "checkbox") {
    return (
      <div className="pt-2 flex items-start gap-2.5">
        <input
          type="checkbox"
          id={node_id}
          checked={Boolean(currentValue)}
          onChange={handleChange}
          disabled={readonly}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1e295d] focus:ring-[#1e295d] cursor-pointer"
        />
        <label htmlFor={node_id} className="text-xs text-slate-700 leading-relaxed cursor-pointer select-none">
          {description || label}
        </label>
      </div>
    );
  }

  return (
    <div className={`w-full transition-all relative ${isSelected ? "ring-2 ring-[#1e295d] rounded-lg p-1" : ""}`}>
      {/* Field Label */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1">
          <label className="text-xs font-semibold text-slate-700">
            {label}
            {required && <span className="text-red-500 ml-1 font-bold">*</span>}
          </label>

          {description && (
            <div className="group relative cursor-pointer">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block w-52 p-2 text-[11px] text-white bg-slate-800 rounded-lg shadow-xl border border-slate-700 z-20">
                {description}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isSelected && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-900">
              <Sparkles className="w-3 h-3" />
              AI Focused
            </span>
          )}

          {readonly && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
              <Lock className="w-3 h-3" />
              Read-Only
            </span>
          )}
        </div>
      </div>

      {/* Soft Light Input & Dropdown Control (Exact Match with Reference Screenshot) */}
      {field_type === "select" ? (
        <div className="relative">
          <select
            value={currentValue}
            onChange={handleChange}
            disabled={readonly}
            className="w-full appearance-none px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-[#f1f3f6] border border-slate-200/60 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1e295d] disabled:bg-slate-200/60 disabled:opacity-80 disabled:cursor-not-allowed cursor-pointer pr-8"
          >
            <option value="" disabled>Select</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      ) : field_type === "switch" ? (
        <label className="inline-flex items-center gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={Boolean(currentValue)}
            onChange={handleChange}
            disabled={readonly}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1e295d]"></div>
          <span className="text-xs text-slate-700 font-medium">
            {currentValue ? "Yes / Approved" : "No / Pending"}
          </span>
        </label>
      ) : field_type === "rating" ? (
        <div className="flex items-center gap-1 py-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              disabled={readonly}
              onClick={() => onChange(node_id, star)}
              className="p-0.5 text-amber-500 hover:scale-110 transition-transform"
            >
              <Star
                className={`w-4 h-4 ${
                  star <= Number(currentValue)
                    ? "fill-amber-400 text-amber-400"
                    : "text-slate-300"
                }`}
              />
            </button>
          ))}
          <span className="text-xs text-slate-500 ml-2">
            ({currentValue || 0} / 5 Stars)
          </span>
        </div>
      ) : field_type === "textarea" ? (
        <textarea
          rows={3}
          placeholder={placeholder}
          value={currentValue}
          onChange={handleChange}
          disabled={readonly}
          className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-[#f1f3f6] border border-slate-200/60 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1e295d] disabled:bg-slate-200/60 disabled:opacity-80 disabled:cursor-not-allowed resize-none"
        />
      ) : (
        <input
          type={field_type === "number" ? "number" : field_type === "email" ? "email" : "text"}
          placeholder={placeholder}
          value={currentValue}
          onChange={handleChange}
          disabled={readonly}
          className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-[#f1f3f6] border border-slate-200/60 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1e295d] disabled:bg-slate-200/60 disabled:opacity-80 disabled:cursor-not-allowed"
        />
      )}

      {readonly && (
        <p className="text-[10px] text-amber-700 mt-1">
          🔒 Locked read-only field.
        </p>
      )}
    </div>
  );
};
