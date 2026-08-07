export type NodeType =
  | "form"
  | "tab"
  | "section"
  | "panel"
  | "group"
  | "container"
  | "field"
  | "action_button";

export type FieldType =
  | "text"
  | "number"
  | "email"
  | "phone"
  | "select"
  | "date"
  | "textarea"
  | "checkbox"
  | "switch"
  | "rating"
  | "radio";

export interface FormNode {
  node_id: string;
  node_type: NodeType;
  label: string;
  field_type?: FieldType;
  readonly?: boolean;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  description?: string;
  value?: any;
  children?: FormNode[];
}

export interface FormAction {
  action_type: string;
  node_id?: string;
  field_label?: string;
  old_value?: any;
  new_value?: any;
  timestamp?: string;
  message?: string;
}

export interface FormAgentState {
  formTree: FormNode;
  fieldValues: Record<string, any>;
  selectedTab: string;
  selectedNode: string | null;
  conversationHistory: FormAction[];
  lastAction: FormAction | null;
  pendingUpdates?: Record<string, any>;
  isProcessing?: boolean;
  error?: string | null;
}
