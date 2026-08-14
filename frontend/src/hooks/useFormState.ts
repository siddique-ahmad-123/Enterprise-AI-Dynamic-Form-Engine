import { useCoAgent, useCopilotAction } from "@copilotkit/react-core";
import { FormAgentState } from "../types/form";
import { defaultFormState } from "../state/defaultFormTree";

/**
 * Custom hook connecting the React UI to the LangGraph form_agent
 * via CopilotKit bidirectional shared state.
 */
export function useFormState() {
  const { state: rawState, setState, run, stop, running } = useCoAgent<FormAgentState>({
    name: "form_agent",
    initialState: defaultFormState,
  });

  // Merge raw state with defaults to prevent null/undefined during hydration
  const state: FormAgentState = {
    formTree: rawState?.formTree || defaultFormState.formTree,
    fieldValues: { ...defaultFormState.fieldValues, ...(rawState?.fieldValues || {}) },
    selectedTab: rawState?.selectedTab || defaultFormState.selectedTab,
    selectedNode: rawState?.selectedNode ?? defaultFormState.selectedNode,
    conversationHistory: rawState?.conversationHistory || defaultFormState.conversationHistory,
    lastAction: rawState?.lastAction ?? defaultFormState.lastAction,
    isProcessing: rawState?.isProcessing ?? running,
    error: rawState?.error ?? null,
  };

  /**
   * Updates a single field value and immediately synchronizes to CopilotKit shared state.
   */
  const updateFieldValue = (nodeId: string, value: any) => {
    const updatedValues = {
      ...state.fieldValues,
      [nodeId]: value,
    };
    setState({
      ...state,
      fieldValues: updatedValues,
      selectedNode: nodeId,
      error: null,
    });
  };

  /**
   * Updates multiple field values simultaneously.
   */
  const updateMultipleFields = (updates: Array<{ nodeId: string; value: any }>) => {
    const newVals = { ...state.fieldValues };
    updates.forEach((u) => {
      newVals[u.nodeId] = u.value;
    });
    setState({
      ...state,
      fieldValues: newVals,
      error: null,
    });
  };

  /**
   * Switches the active tab in shared state.
   */
  const setSelectedTab = (tabId: string) => {
    setState({
      ...state,
      selectedTab: tabId,
    });
  };

  /**
   * Focuses or highlights a node.
   */
  const setSelectedNode = (nodeId: string | null) => {
    setState({
      ...state,
      selectedNode: nodeId,
    });
  };

  /**
   * Resets form values to default state.
   */
  const resetForm = () => {
    setState(defaultFormState);
  };

  // ─────────────────────────────────────────────────────────────
  // Registered CopilotKit Action Tools
  // ─────────────────────────────────────────────────────────────

  useCopilotAction({
    name: "update_field",
    description: "Updates a single form field value by node_id or label",
    parameters: [
      { name: "node_id", type: "string", description: "Target field node_id" },
      { name: "value", type: "string", description: "New value to set" },
    ],
    handler: async ({ node_id, value }) => {
      updateFieldValue(node_id, value);
      return `Updated ${node_id} to ${value}`;
    },
  });

  useCopilotAction({
    name: "update_multiple_fields",
    description: "Updates multiple form fields in a single call (e.g. name, nationality, residence country)",
    parameters: [
      {
        name: "updates",
        type: "object[]",
        description: "Array of objects containing { node_id, value }",
      },
    ],
    handler: async ({ updates }) => {
      if (Array.isArray(updates)) {
        updateMultipleFields(updates as any);
        return `Updated ${updates.length} fields successfully.`;
      }
      return "No updates provided.";
    },
  });

  useCopilotAction({
    name: "clear_field",
    description: "Clears or resets a form field value",
    parameters: [
      { name: "node_id", type: "string", description: "Target field node_id to clear" },
    ],
    handler: async ({ node_id }) => {
      updateFieldValue(node_id, "");
      return `Cleared field ${node_id}`;
    },
  });

  useCopilotAction({
    name: "navigate_tab",
    description: "Switches active tab in the form (tab_consents, tab_personal_borrower, tab_personal_coborrower, tab_income_borrower, tab_product_loan, tab_decision)",
    parameters: [
      { name: "tab_id", type: "string", description: "Tab node_id" },
    ],
    handler: async ({ tab_id }) => {
      setSelectedTab(tab_id);
      return `Switched to tab ${tab_id}`;
    },
  });

  return {
    state,
    setState,
    updateFieldValue,
    updateMultipleFields,
    setSelectedTab,
    setSelectedNode,
    resetForm,
    run,
    stop,
    running: running || state.isProcessing,
  };
}

