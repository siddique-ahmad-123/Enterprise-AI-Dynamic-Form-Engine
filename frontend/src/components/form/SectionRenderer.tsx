import React from "react";
import { FormNode } from "../../types/form";
import { ContainerRenderer } from "./ContainerRenderer";

interface SectionRendererProps {
  node: FormNode;
  fieldValues: Record<string, any>;
  onFieldChange: (nodeId: string, value: any) => void;
  selectedNode: string | string[] | null;
}

export const SectionRenderer: React.FC<SectionRendererProps> = ({
  node,
  fieldValues,
  onFieldChange,
  selectedNode,
}) => {
  const { label, description, children = [] } = node;

  return (
    <div className="mb-6 p-5 rounded-xl border border-slate-200/80 bg-white shadow-sm">
      {/* Light Ice-Blue Banner (Exact Match with Newgen Screenshot) */}
      <div className="bg-[#edf4fc] text-[#1e295d] px-4 py-3 rounded-lg mb-5 font-semibold text-sm flex items-center justify-between">
        <span>{label}</span>
        {description && (
          <span className="text-xs font-normal text-slate-600 hidden sm:inline">
            {description}
          </span>
        )}
      </div>

      {/* Section Fields Body */}
      <div>
        <ContainerRenderer
          node={{ node_id: `${node.node_id}_group`, node_type: "group", label: node.label, children }}
          fieldValues={fieldValues}
          onFieldChange={onFieldChange}
          selectedNode={selectedNode}
        />
      </div>
    </div>
  );
};
