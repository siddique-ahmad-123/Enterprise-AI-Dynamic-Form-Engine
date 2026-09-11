import React from "react";
import { FormNode } from "../../types/form";
import { SectionRenderer } from "./SectionRenderer";
import { ContainerRenderer } from "./ContainerRenderer";

interface TabRendererProps {
  tabNode: FormNode;
  fieldValues: Record<string, any>;
  onFieldChange: (nodeId: string, value: any) => void;
  selectedNode: string | string[] | null;
  isSubmitted?: boolean;
}

export const TabRenderer: React.FC<TabRendererProps> = ({
  tabNode,
  fieldValues,
  onFieldChange,
  selectedNode,
  isSubmitted = false,
}) => {
  const children = tabNode.children || [];

  return (
    <div className="pt-2">
      {children.map((child) => {
        if (child.node_type === "section") {
          return (
            <SectionRenderer
              key={child.node_id}
              node={child}
              fieldValues={fieldValues}
              onFieldChange={onFieldChange}
              selectedNode={selectedNode}
              isSubmitted={isSubmitted}
            />
          );
        }
        return (
          <ContainerRenderer
            key={child.node_id}
            node={child}
            fieldValues={fieldValues}
            onFieldChange={onFieldChange}
            selectedNode={selectedNode}
            isSubmitted={isSubmitted}
          />
        );
      })}
    </div>
  );
};
