import React from "react";
import { Lock, Sparkles, HelpCircle, Star, ChevronDown, Upload, Sliders } from "lucide-react";
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
    min = 0,
    max = 100,
    step = 1,
    unit = "",
  } = node;

  const currentValue = value !== undefined && value !== null ? value : "";

  // 1. Action Button Nodes
  if (node_type === "action_button") {
    return (
      <div className="pt-2">
        <button
          type="button"
          onClick={() => onChange(node_id, true)}
          className="bg-[#1e295d] hover:bg-[#151e45] text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-sm transition-all duration-200 focus:outline-none flex items-center gap-2 cursor-pointer"
        >
          <span>{label}</span>
        </button>
      </div>
    );
  }

  // 2. Upload Nodes
  if (node_type === "upload" || field_type === "file") {
    return (
      <div className="w-full bg-[#f8fafc] border border-dashed border-slate-300 rounded-lg p-3 text-center space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-indigo-600" />
            {label}
            {required && <span className="text-red-500 font-bold">*</span>}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">{currentValue ? "File Attached" : "PDF / PNG / JPG"}</span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <input
            type="file"
            id={node_id}
            disabled={readonly}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onChange(node_id, file.name);
            }}
            className="hidden"
          />
          <label
            htmlFor={node_id}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-xs font-medium text-slate-700 cursor-pointer transition-colors"
          >
            {currentValue ? `Replace ${currentValue}` : "Browse File"}
          </label>
          <span className="text-xs font-mono text-emerald-700 truncate max-w-[150px]">
            {currentValue || "No file chosen"}
          </span>
        </div>
      </div>
    );
  }

  // 3. Segment Nodes (Options Pills / Radio Buttons)
  if (node_type === "segment") {
    const opts = options.length > 0 ? options : ["Yes", "No"];
    return (
      <div className="w-full space-y-1.5">
        <label className="text-xs font-semibold text-slate-700 block">
          {label}
          {required && <span className="text-red-500 ml-1 font-bold">*</span>}
        </label>
        <div className="flex flex-wrap items-center gap-2 p-1 bg-[#f1f3f6] rounded-lg border border-slate-200/60 w-fit">
          {opts.map((opt) => {
            const isSelectedOpt = String(currentValue) === String(opt);
            return (
              <button
                key={opt}
                type="button"
                disabled={readonly}
                onClick={() => onChange(node_id, opt)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  isSelectedOpt
                    ? "bg-[#1e295d] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 4. Slider Nodes (Interactive Range Input)
  if (node_type === "slider") {
    const numVal = typeof currentValue === "number" ? currentValue : Number(currentValue) || min;
    return (
      <div className="w-full space-y-2 bg-slate-50/80 p-3 rounded-lg border border-slate-200/60">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            {label}
          </label>
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded text-xs font-bold font-mono">
            {numVal.toLocaleString()} {unit}
          </span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numVal}
          disabled={readonly}
          onChange={(e) => onChange(node_id, Number(e.target.value))}
          className="w-full accent-[#1e295d] h-2 bg-slate-200 rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>{min.toLocaleString()} {unit}</span>
          <span>{max.toLocaleString()} {unit}</span>
        </div>
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

  // 5. Checkbox Field
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

      {/* Input Controls */}
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
      ) : (field_type as any) === "rating" ? (

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
          type={field_type === "number" ? "number" : field_type === "email" ? "email" : field_type === "date" ? "date" : "text"}
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
