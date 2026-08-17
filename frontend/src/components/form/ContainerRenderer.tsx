import React from "react";
import { FormNode } from "../../types/form";
import { FieldRenderer } from "./FieldRenderer";

interface ContainerRendererProps {
  node: FormNode;
  fieldValues: Record<string, any>;
  onFieldChange: (nodeId: string, value: any) => void;
  selectedNode: string | string[] | null;
}

export const ContainerRenderer: React.FC<ContainerRendererProps> = ({
  node,
  fieldValues,
  onFieldChange,
  selectedNode,
}) => {
  const { node_type, label, children = [], description } = node;

  if (node_type === "field" || node_type === "action_button") {
    const isSelected = Array.isArray(selectedNode)
      ? selectedNode.includes(node.node_id)
      : selectedNode === node.node_id;

    return (
      <FieldRenderer
        node={node}
        value={fieldValues[node.node_id]}
        onChange={onFieldChange}
        isSelected={isSelected}
      />
    );
  }

  return (
    <div className="w-full">
      {label && node_type !== "container" && node_type !== "group" && (
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          {label}
        </h4>
      )}
      {description && (
        <p className="text-xs text-slate-500 mb-3">
          {description}
        </p>
      )}

      {/* Strict 3-Column Grid Layout Matching Enterprise Reference Screenshot */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5 items-start">
        {children.map((child) => {
          const isFullWidth =
            child.field_type === "textarea" ||
            child.field_type === "checkbox" ||
            child.node_type === "section";

          return (
            <div
              key={child.node_id}
              className={isFullWidth ? "col-span-1 md:col-span-3" : "col-span-1"}
            >
              <ContainerRenderer
                node={child}
                fieldValues={fieldValues}
                onFieldChange={onFieldChange}
                selectedNode={selectedNode}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
