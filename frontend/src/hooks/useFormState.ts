import { useCoAgent, useCopilotAction } from "@copilotkit/react-core";
import { FormNode, FormAgentState } from "../types/form";
import { defaultFormState } from "../state/defaultFormTree";

/**
 * Checks whether a given tab's mandatory (required) fields are all filled
 * in the provided fieldValues map, taking into account conditional section visibility.
 */
export function isTabMandatoryComplete(tabNode: FormNode, fieldValues: Record<string, any>): boolean {
  if (!tabNode) return false;

  // Special handling for Co-Borrower tab
  if (tabNode.node_id === "tab_personal_coborrower") {
    const isCoBorrowerVal = fieldValues["isCoBorrower"];
    if (!isCoBorrowerVal || isCoBorrowerVal === "" || isCoBorrowerVal === "Select") {
      return false; // User hasn't answered the mandatory segment question yet
    }
    if (isCoBorrowerVal === "No") {
      return true; // Co-borrower not needed, tab is satisfied
    }
    // If "Yes", check required co-borrower fields
    const requiredCoBorrowerFields = ["coBorrowerName", "coBorrowerMobileNo", "coBorrowerEidaNo"];
    return requiredCoBorrowerFields.every((fid) => {
      const val = fieldValues[fid];
      return val !== undefined && val !== null && String(val).trim() !== "" && val !== "Select";
    });
  }

  // General recursive traversal of tab nodes
  const isNodeConditionMet = (node: FormNode): boolean => {
    if (!node.condition) return true;
    if (node.condition.includes("===")) {
      const [varName, expectedValRaw] = node.condition.split("===").map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
      const currentVal = fieldValues[varName];
      return String(currentVal) === expectedValRaw;
    }
    return true;
  };

  const checkNode = (node: FormNode): boolean => {
    if (!isNodeConditionMet(node)) {
      return true; // Hidden/inactive container, child required fields don't block
    }

    if (node.required && !node.readonly && (node.node_type === "field" || node.node_type === "upload" || node.node_type === "segment")) {
      const val = fieldValues[node.node_id];
      if (val === undefined || val === null || val === "" || val === false || val === "Select" || (Array.isArray(val) && val.length === 0)) {
        return false;
      }
    }

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        if (!checkNode(child)) {
          return false;
        }
      }
    }

    return true;
  };

  return checkNode(tabNode);
}

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
   * Evaluates auto tab progression after field values change
   */
  const getAutoNavState = (newValues: Record<string, any>, lastTouchedNodeId?: string) => {
    const tabs = (state.formTree.children || []).filter((c) => c.node_type === "tab");
    const currentTabIndex = tabs.findIndex((t) => t.node_id === state.selectedTab);
    const currentTabNode = tabs[currentTabIndex];

    if (currentTabNode && currentTabIndex >= 0 && currentTabIndex < tabs.length - 1) {
      const isComplete = isTabMandatoryComplete(currentTabNode, newValues);
      if (isComplete) {
        const nextTabNode = tabs[currentTabIndex + 1];
        return {
          selectedTab: nextTabNode.node_id,
          lastAction: {
            action_type: "AUTO_NAVIGATE",
            message: `✨ All mandatory fields in '${currentTabNode.label}' completed! Auto-moved to '${nextTabNode.label}'.`,
            timestamp: new Date().toISOString(),
          },
        };
      }
    }
    return null;
  };

  /**
   * Updates a single field value and immediately synchronizes to CopilotKit shared state.
   */
  const updateFieldValue = (nodeId: string, value: any) => {
    const updatedValues = {
      ...state.fieldValues,
      [nodeId]: value,
    };
    const autoNav = getAutoNavState(updatedValues, nodeId);

    setState({
      ...state,
      fieldValues: updatedValues,
      selectedNode: nodeId,
      selectedTab: autoNav ? autoNav.selectedTab : state.selectedTab,
      lastAction: autoNav ? autoNav.lastAction : state.lastAction,
      error: null,
    });
  };

  /**
   * Updates multiple field values simultaneously.
   */
  const updateMultipleFields = (updates: Array<{ nodeId: string; value: any }>) => {
    const newVals = { ...state.fieldValues };
    const modifiedNodeIds: string[] = [];
    updates.forEach((u) => {
      newVals[u.nodeId] = u.value;
      if (u.nodeId) modifiedNodeIds.push(u.nodeId);
    });
    const autoNav = getAutoNavState(newVals);

    setState({
      ...state,
      fieldValues: newVals,
      selectedNode: modifiedNodeIds.length > 0 ? modifiedNodeIds : state.selectedNode,
      selectedTab: autoNav ? autoNav.selectedTab : state.selectedTab,
      lastAction: autoNav ? autoNav.lastAction : state.lastAction,
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

