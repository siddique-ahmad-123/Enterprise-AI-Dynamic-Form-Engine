export type NodeType =
  | "form"
  | "tab"
  | "section"
  | "panel"
  | "group"
  | "container"
  | "field"
  | "action_button"
  | "upload"
  | "slider"
  | "segment";

export type FieldType =
  | "text"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "checkbox"
  | "switch"
  | "textarea"
  | "file";

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
  condition?: string;
  value?: any;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
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
