import React, { useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { FormNode, FormAction } from "../../types/form";
import { TabRenderer } from "./TabRenderer";

interface FormRendererProps {
  formTree: FormNode;
  fieldValues: Record<string, any>;
  selectedTab: string;
  onTabChange: (tabId: string) => void;
  onFieldChange: (nodeId: string, value: any) => void;
  selectedNode: string | null;
  lastAction: FormAction | null;
  isProcessing?: boolean;
}

export const FormRenderer: React.FC<FormRendererProps> = ({
  formTree,
  fieldValues,
  selectedTab,
  onTabChange,
  onFieldChange,
  selectedNode,
  lastAction,
  isProcessing = false,
}) => {
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const tabs = (formTree.children || []).filter((c) => c.node_type === "tab");

  const handleScroll = (direction: "left" | "right") => {
    if (tabContainerRef.current) {
      const scrollAmount = direction === "left" ? -250 : 250;
      tabContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // Calculate form completion statistics
  const countFields = (node: FormNode): { total: number; filled: number } => {
    let total = 0;
    let filled = 0;
    if (node.node_type === "field") {
      total = 1;
      const val = fieldValues[node.node_id];
      if (val !== undefined && val !== null && val !== "" && val !== false && val !== "Select") {
        filled = 1;
      }
    }
    if (node.children) {
      for (const child of node.children) {
        const stats = countFields(child);
        total += stats.total;
        filled += stats.filled;
      }
    }
    return { total, filled };
  };

  const stats = countFields(formTree);
  const completionPercentage =
    stats.total > 0 ? Math.round((stats.filled / stats.total) * 100) : 0;

  const activeIndex = tabs.findIndex((t) => t.node_id === selectedTab);
  const currentTabIndex = activeIndex >= 0 ? activeIndex : 0;
  const currentTabNode = tabs[currentTabIndex] || tabs[0];

  return (
    <div className="w-full mx-auto space-y-4">
      {/* Real-time Agent Status Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-[#1e295d]">
              {formTree.label}
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isProcessing
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isProcessing ? "animate-spin" : ""}`}
              />
              {isProcessing ? "AI Agent Processing..." : "Real-Time Sync Active"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-[#1e295d] transition-all duration-500 rounded-full"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-600">
                {completionPercentage}% Filled
              </span>
            </div>
          </div>
        </div>

        {/* Latest AI Action Banner */}
        {lastAction && (
          <div className="mt-3 p-2 rounded-md bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#1e295d] shrink-0" />
            <span>
              ⚡ <strong>AI Agent Action:</strong> {lastAction.message}
            </span>
          </div>
        )}
      </div>

      {/* Enterprise Stepper Tab Bar (Exact Match with Reference Screenshot) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center border-b border-slate-200 relative bg-white px-2 py-2">
          {/* Scroll Left Button */}
          <button
            onClick={() => handleScroll("left")}
            aria-label="Scroll Left"
            className="p-2 text-slate-400 hover:text-slate-700 transition-colors z-10 shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Horizontal Stepper Tabs List */}
          <div
            ref={tabContainerRef}
            className="flex items-center gap-6 overflow-x-auto scroll-smooth flex-1 px-4 py-2"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {tabs.map((tab, idx) => {
              const isActive = tab.node_id === selectedTab;
              const isCompleted = idx < currentTabIndex;

              return (
                <button
                  key={tab.node_id}
                  onClick={() => onTabChange(tab.node_id)}
                  className={`flex items-center gap-2.5 pb-2 pt-1 px-1 transition-all whitespace-nowrap text-xs font-semibold relative ${
                    isActive
                      ? "text-[#1e295d] font-bold border-b-2 border-[#1e295d]"
                      : isCompleted
                      ? "text-slate-700 hover:text-[#1e295d]"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {/* Step Indicator Circle */}
                  {isCompleted ? (
                    <span className="w-6 h-6 rounded-full bg-[#1e295d] text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  ) : isActive ? (
                    <span className="w-6 h-6 rounded-full bg-[#1e295d] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                      {idx + 1}
                    </span>
                  ) : (
                    <span className="w-6 h-6 rounded-full border border-slate-400 text-slate-600 flex items-center justify-center text-xs font-medium shrink-0">
                      {idx + 1}
                    </span>
                  )}

                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={() => handleScroll("right")}
            aria-label="Scroll Right"
            className="p-2 text-slate-400 hover:text-slate-700 transition-colors z-10 shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Body Container */}
        <div className="p-6 bg-white">
          {currentTabNode && (
            <TabRenderer
              tabNode={currentTabNode}
              fieldValues={fieldValues}
              onFieldChange={onFieldChange}
              selectedNode={selectedNode}
            />
          )}
        </div>
      </div>
    </div>
  );
};
