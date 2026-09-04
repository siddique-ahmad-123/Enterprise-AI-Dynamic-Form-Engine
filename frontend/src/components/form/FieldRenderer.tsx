import React from "react";
import { Lock, Sparkles, HelpCircle, Star, ChevronDown, Upload, Sliders } from "lucide-react";
import { FormNode } from "../../types/form";

interface FieldRendererProps {
  node: FormNode;
  value: any;
  onChange: (nodeId: string, value: any) => void;
  isSelected?: boolean;
  isSubmitted?: boolean;
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({
  node,
  value,
  onChange,
  isSelected = false,
  isSubmitted = false,
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

  const isFieldDisabled = readonly || isSubmitted;
  const currentValue = value !== undefined && value !== null ? value : "";

  const handleSafeChange = (newVal: any) => {
    if (isSubmitted) {
      window.dispatchEvent(new CustomEvent("show-already-submitted"));
      return;
    }
    if (readonly) return;
    onChange(node_id, newVal);
  };

  // 1. Action Button Nodes
  if (node_type === "action_button") {
    return (
      <div className="pt-2">
        <button
          type="button"
          disabled={isFieldDisabled}
          onClick={() => handleSafeChange(true)}
          className={`font-semibold text-xs px-5 py-2.5 rounded-lg shadow-sm transition-all duration-200 focus:outline-none flex items-center gap-2 ${
            isFieldDisabled
              ? "bg-slate-300 text-slate-500 cursor-not-allowed"
              : "bg-[#1e295d] hover:bg-[#151e45] text-white cursor-pointer"
          }`}
        >
          <span>{label}</span>
          {isSubmitted && <Lock className="w-3 h-3 text-slate-500" />}
        </button>
      </div>
    );
  }

  // 2. Upload Nodes
  if (node_type === "upload" || field_type === "file") {
    return (
      <div className={`w-full border border-dashed rounded-lg p-3 text-center space-y-2 ${isFieldDisabled ? "bg-slate-100/70 border-slate-300 opacity-90" : "bg-[#f8fafc] border-slate-300"}`}>
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
            disabled={isFieldDisabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleSafeChange(file.name);
            }}
            className="hidden"
          />
          <label
            htmlFor={isFieldDisabled ? undefined : node_id}
            onClick={() => {
              if (isSubmitted) window.dispatchEvent(new CustomEvent("show-already-submitted"));
            }}
            className={`px-3 py-1.5 border rounded text-xs font-medium transition-colors ${
              isFieldDisabled
                ? "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 cursor-pointer"
            }`}
          >
            {currentValue ? `Attached: ${currentValue}` : "Browse File"}
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
      <div className={`w-full space-y-1.5 transition-all duration-300 relative rounded-xl p-2 ${isSelected ? "ring-2 ring-indigo-500 bg-indigo-50/50 shadow-md shadow-indigo-500/10 border border-indigo-200" : ""}`}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700 block">
            {label}
            {required && <span className="text-red-500 ml-1 font-bold">*</span>}
          </label>
          {isSelected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-xs animate-pulse">
              <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
              AI Focused
            </span>
          )}
          {isFieldDisabled && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
              <Lock className="w-3 h-3" />
              Read-Only
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 p-1 bg-[#f1f3f6] rounded-lg border border-slate-200/60 w-fit">
          {opts.map((opt) => {
            const isSelectedOpt = String(currentValue) === String(opt);
            return (
              <button
                key={opt}
                type="button"
                disabled={isFieldDisabled}
                onClick={() => handleSafeChange(opt)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                  isFieldDisabled
                    ? isSelectedOpt
                      ? "bg-slate-700 text-white cursor-not-allowed opacity-90 shadow-xs"
                      : "text-slate-400 bg-transparent cursor-not-allowed"
                    : isSelectedOpt
                    ? "bg-[#1e295d] text-white shadow-xs cursor-pointer"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer"
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
      <div className={`w-full space-y-2 bg-slate-50/80 p-3 rounded-lg border border-slate-200/60 transition-all duration-300 relative ${isSelected ? "ring-2 ring-indigo-500 bg-indigo-50/50 shadow-md shadow-indigo-500/10 border border-indigo-200" : ""}`}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            {label}
          </label>
          <div className="flex items-center gap-1.5">
            {isSelected && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-xs animate-pulse">
                <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
                AI Focused
              </span>
            )}
            {isFieldDisabled && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                <Lock className="w-3 h-3" />
                Read-Only
              </span>
            )}
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded text-xs font-bold font-mono">
              {numVal.toLocaleString()} {unit}
            </span>
          </div>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numVal}
          disabled={isFieldDisabled}
          onChange={(e) => handleSafeChange(Number(e.target.value))}
          className={`w-full accent-[#1e295d] h-2 bg-slate-200 rounded-lg ${isFieldDisabled ? "cursor-not-allowed opacity-75" : "cursor-pointer"}`}
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>{min.toLocaleString()} {unit}</span>
          <span>{max.toLocaleString()} {unit}</span>
        </div>
      </div>
    );
  }

  const handleChange = (e: any) => {
    let newVal: any = e.target ? e.target.value : e;
    if (field_type === "switch" || field_type === "checkbox") {
      newVal = e.target.checked;
    }
    handleSafeChange(newVal);
  };

  // 5. Checkbox Field
  if (field_type === "checkbox") {
    return (
      <div className={`pt-2 flex items-start gap-2.5 transition-all duration-300 rounded-xl p-2 ${isSelected ? "ring-2 ring-indigo-500 bg-indigo-50/50 shadow-md shadow-indigo-500/10 border border-indigo-200" : ""}`}>
        <input
          type="checkbox"
          id={node_id}
          checked={Boolean(currentValue)}
          onChange={handleChange}
          disabled={isFieldDisabled}
          className={`mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1e295d] focus:ring-[#1e295d] ${isFieldDisabled ? "cursor-not-allowed opacity-75" : "cursor-pointer"}`}
        />
        <div className="flex-1 flex items-center justify-between">
          <label htmlFor={isFieldDisabled ? undefined : node_id} className={`text-xs text-slate-700 leading-relaxed select-none ${isFieldDisabled ? "cursor-not-allowed text-slate-600" : "cursor-pointer"}`}>
            {description || label}
          </label>
          {isSelected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-xs animate-pulse shrink-0">
              <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
              AI Focused
            </span>
          )}
          {isFieldDisabled && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0 ml-2">
              <Lock className="w-3 h-3" />
              Read-Only
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full transition-all duration-300 relative rounded-xl p-2 ${isSelected ? "ring-2 ring-indigo-500 bg-indigo-50/50 shadow-md shadow-indigo-500/10 border border-indigo-200" : ""}`}>
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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-xs animate-pulse">
              <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
              AI Focused
            </span>
          )}

          {isFieldDisabled && (
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
            disabled={isFieldDisabled}
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
        <label className={`inline-flex items-center gap-2 pt-1 ${isFieldDisabled ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}>
          <input
            type="checkbox"
            checked={Boolean(currentValue)}
            onChange={handleChange}
            disabled={isFieldDisabled}
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
              disabled={isFieldDisabled}
              onClick={() => handleSafeChange(star)}
              className={`p-0.5 transition-transform ${isFieldDisabled ? "cursor-not-allowed opacity-80" : "hover:scale-110 cursor-pointer"}`}
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
          disabled={isFieldDisabled}
          className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-[#f1f3f6] border border-slate-200/60 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1e295d] disabled:bg-slate-200/60 disabled:opacity-80 disabled:cursor-not-allowed resize-none"
        />
      ) : (
        <input
          type={field_type === "number" ? "number" : field_type === "email" ? "email" : field_type === "date" ? "date" : "text"}
          placeholder={placeholder}
          value={currentValue}
          onChange={handleChange}
          disabled={isFieldDisabled}
          className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-[#f1f3f6] border border-slate-200/60 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1e295d] disabled:bg-slate-200/60 disabled:opacity-80 disabled:cursor-not-allowed"
        />
      )}

      {isFieldDisabled && (
        <p className="text-[10px] text-amber-700 mt-1">
          🔒 Locked read-only field.
        </p>
      )}
    </div>
  );
};
