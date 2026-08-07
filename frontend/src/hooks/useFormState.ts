import { useCoAgent } from "@copilotkit/react-core";
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

  return {
    state,
    setState,
    updateFieldValue,
    setSelectedTab,
    setSelectedNode,
    resetForm,
    run,
    stop,
    running: running || state.isProcessing,
  };
}
