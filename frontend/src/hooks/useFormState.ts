import { useState, useEffect } from "react";
import { useCoAgent, useCopilotAction } from "@copilotkit/react-core";
import { FormNode, FormAgentState } from "../types/form";
import { defaultFormState, areAllConsentsChecked, CONSENT_FIELD_IDS } from "../state/defaultFormTree";

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

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

/**
 * Custom hook connecting the React UI to the LangGraph form_agent
 * via CopilotKit bidirectional shared state.
 */
export function useFormState(threadId?: string, isSubmittedProp: boolean = false) {
  const [localHydrated, setLocalHydrated] = useState<{
    fieldValues: Record<string, any>;
    selectedTab?: string;
    journeyStatus?: string;
  } | null>(null);

  const { state: rawState, setState, run, stop, running } = useCoAgent<FormAgentState>({
    name: "form_agent",
    initialState: defaultFormState,
  });

  const isFormSubmitted = Boolean(
    isSubmittedProp ||
    rawState?.journeyStatus === "SUBMITTED" ||
    localHydrated?.journeyStatus === "SUBMITTED"
  );

  // Calculate merged field values:
  // Base: defaultFormState.fieldValues (empty defaults)
  // Layer 2: localHydrated.fieldValues (loaded from PostgreSQL)
  // Layer 3: rawState.fieldValues (live updates from CoAgent/LangGraph)
  const mergedFieldValues: Record<string, any> = {
    ...defaultFormState.fieldValues,
    ...(localHydrated?.fieldValues || {}),
  };

  if (rawState?.fieldValues) {
    for (const [k, v] of Object.entries(rawState.fieldValues)) {
      if (v !== undefined && v !== null && v !== "") {
        // If localHydrated loaded true for a consent checkbox, NEVER let rawState's default false clobber it
        if (CONSENT_FIELD_IDS.includes(k) && localHydrated?.fieldValues?.[k] === true && v === false) {
          continue;
        }
        mergedFieldValues[k] = v;
      }
    }
  }

  // If application is submitted, or if user has entered data past Step 0, or if consents were checked in database:
  const hasFilledDataPastConsents = Object.entries(mergedFieldValues).some(
    ([k, v]) => !CONSENT_FIELD_IDS.includes(k) && k !== "selectedRequiredAmount" && v !== undefined && v !== null && v !== "" && v !== false
  );

  if (isFormSubmitted || hasFilledDataPastConsents || areAllConsentsChecked(localHydrated?.fieldValues)) {
    for (const cid of CONSENT_FIELD_IDS) {
      mergedFieldValues[cid] = true;
    }
  }

  // Merge raw state with defaults to prevent null/undefined during hydration
  const state: FormAgentState = {
    formTree: rawState?.formTree || defaultFormState.formTree,
    fieldValues: mergedFieldValues,
    selectedTab: rawState?.selectedTab || localHydrated?.selectedTab || defaultFormState.selectedTab,
    selectedNode: rawState?.selectedNode ?? defaultFormState.selectedNode,
    conversationHistory: rawState?.conversationHistory || defaultFormState.conversationHistory,
    lastAction: rawState?.lastAction ?? defaultFormState.lastAction,
    journeyStatus: isFormSubmitted ? "SUBMITTED" : (rawState?.journeyStatus || localHydrated?.journeyStatus || defaultFormState.journeyStatus),
    isProcessing: rawState?.isProcessing ?? running,
    error: rawState?.error ?? null,
  };

  /**
   * Loads saved form field values and status from PostgreSQL for a given threadId
   */
  const loadFormState = async (targetThreadId: string) => {
    if (!targetThreadId) return null;
    try {
      const res = await fetch(`${BACKEND_URL}/chat/${encodeURIComponent(targetThreadId)}/state`);
      if (res.ok) {
        const data = await res.json();
        const loadedValues = data.field_values || {};
        const loadedTab = data.selected_tab || defaultFormState.selectedTab;
        const loadedJourney = data.journey_status || (data.is_submitted ? "SUBMITTED" : defaultFormState.journeyStatus);
        const isSub = Boolean(data.is_submitted || loadedJourney === "SUBMITTED" || isSubmittedProp);

        const mergedValues = {
          ...defaultFormState.fieldValues,
          ...loadedValues,
        };

        for (const [k, v] of Object.entries(loadedValues)) {
          if (v !== undefined && v !== null && v !== "") {
            mergedValues[k] = v;
          }
        }

        const hasNonConsentFilled = Object.entries(mergedValues).some(
          ([k, v]) => !CONSENT_FIELD_IDS.includes(k) && k !== "selectedRequiredAmount" && v !== undefined && v !== null && v !== "" && v !== false
        );

        if (isSub || hasNonConsentFilled || areAllConsentsChecked(loadedValues)) {
          for (const cid of CONSENT_FIELD_IDS) {
            mergedValues[cid] = true;
          }
        }

        setLocalHydrated({
          fieldValues: mergedValues,
          selectedTab: loadedTab,
          journeyStatus: loadedJourney,
        });

        setState(prev => ({
          ...prev,
          fieldValues: mergedValues,
          selectedTab: loadedTab,
          journeyStatus: loadedJourney,
          error: null,
        }));
        console.log(`[PostgreSQL] Loaded form state for thread '${targetThreadId}':`, Object.keys(loadedValues).length, "fields");
        return data;
      }
    } catch (e) {
      console.warn("Failed to load form state from PostgreSQL:", e);
    }
    return null;
  };

  // Automatically load form state whenever threadId changes
  useEffect(() => {
    setLocalHydrated(null);
    if (threadId) {
      loadFormState(threadId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  /**
   * Helper to persist form state changes to PostgreSQL
   */
  const syncStateToBackend = (values: Record<string, any>, tab: string, journey?: string) => {
    if (!threadId) return;
    if (state.journeyStatus === "SUBMITTED" || journey === "SUBMITTED" || isSubmittedProp) {
      return; // Do not overwrite submitted state with unhydrated client state
    }
    const user = localStorage.getItem("auth_username");
    fetch(`${BACKEND_URL}/chat/${encodeURIComponent(threadId)}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        field_values: values,
        selected_tab: tab,
        journey_status: journey || state.journeyStatus || "IN_PROGRESS",
        username: user,
      }),
    }).catch(() => { });
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
    if (state.journeyStatus === "SUBMITTED") {
      window.dispatchEvent(new CustomEvent("show-already-submitted"));
      return;
    }

    // Consent Check: Block updating any field outside Step 0 until all 3 consents are declared
    if (!CONSENT_FIELD_IDS.includes(nodeId) && nodeId !== "selectedRequiredAmount") {
      if (!areAllConsentsChecked(state.fieldValues)) {
        window.dispatchEvent(new CustomEvent("show-consent-required"));
        return;
      }
    }

    const updatedValues = {
      ...state.fieldValues,
      [nodeId]: value,
    };
    const autoNav = getAutoNavState(updatedValues, nodeId);
    const newTab = autoNav ? autoNav.selectedTab : state.selectedTab;

    setLocalHydrated(prev => ({
      fieldValues: updatedValues,
      selectedTab: newTab,
      journeyStatus: prev?.journeyStatus || state.journeyStatus || "IN_PROGRESS",
    }));

    setState({
      ...state,
      fieldValues: updatedValues,
      selectedNode: nodeId,
      selectedTab: newTab,
      lastAction: autoNav ? autoNav.lastAction : state.lastAction,
      error: null,
    });

    syncStateToBackend(updatedValues, newTab);
  };

  /**
   * Updates multiple field values simultaneously.
   */
  const updateMultipleFields = (updates: Array<{ nodeId: string; value: any }>) => {
    if (state.journeyStatus === "SUBMITTED") {
      window.dispatchEvent(new CustomEvent("show-already-submitted"));
      return;
    }

    // Consent Check: Block updating non-consent fields until all 3 consents are declared
    const hasNonConsentUpdates = updates.some(
      u => !CONSENT_FIELD_IDS.includes(u.nodeId) && u.nodeId !== "selectedRequiredAmount"
    );
    if (hasNonConsentUpdates && !areAllConsentsChecked(state.fieldValues)) {
      window.dispatchEvent(new CustomEvent("show-consent-required"));
      return;
    }

    const newVals = { ...state.fieldValues };
    const modifiedNodeIds: string[] = [];
    updates.forEach((u) => {
      newVals[u.nodeId] = u.value;
      if (u.nodeId) modifiedNodeIds.push(u.nodeId);
    });
    const autoNav = getAutoNavState(newVals);
    const newTab = autoNav ? autoNav.selectedTab : state.selectedTab;

    setLocalHydrated(prev => ({
      fieldValues: newVals,
      selectedTab: newTab,
      journeyStatus: prev?.journeyStatus || state.journeyStatus || "IN_PROGRESS",
    }));

    setState({
      ...state,
      fieldValues: newVals,
      selectedNode: modifiedNodeIds.length > 0 ? modifiedNodeIds : state.selectedNode,
      selectedTab: newTab,
      lastAction: autoNav ? autoNav.lastAction : state.lastAction,
      error: null,
    });

    syncStateToBackend(newVals, newTab);
  };

  /**
   * Automatically accepts all 3 consents in Step 0.
   */
  const acceptAllConsents = () => {
    const updatedValues = {
      ...state.fieldValues,
      isCheckedTermandCond: true,
      isCheckedLifestyle: true,
      isCheckedPrivacy: true,
    };
    setLocalHydrated(prev => ({
      fieldValues: updatedValues,
      selectedTab: prev?.selectedTab || state.selectedTab,
      journeyStatus: prev?.journeyStatus || state.journeyStatus || "IN_PROGRESS",
    }));
    setState({
      ...state,
      fieldValues: updatedValues,
      selectedNode: "isCheckedPrivacy",
      lastAction: {
        action_type: "UPDATE_FIELD",
        message: "✅ All consents & declarations accepted successfully.",
        timestamp: new Date().toISOString(),
      },
      error: null,
    });
    syncStateToBackend(updatedValues, state.selectedTab);
  };

  /**
   * Switches the active tab in shared state.
   */
  const setSelectedTab = (tabId: string) => {
    if (tabId !== "tab_consents" && !areAllConsentsChecked(state.fieldValues)) {
      window.dispatchEvent(new CustomEvent("show-consent-required"));
      return;
    }

    setLocalHydrated(prev => ({
      fieldValues: prev?.fieldValues || state.fieldValues,
      selectedTab: tabId,
      journeyStatus: prev?.journeyStatus || state.journeyStatus || "IN_PROGRESS",
    }));
    setState({
      ...state,
      selectedTab: tabId,
    });
    syncStateToBackend(state.fieldValues, tabId);
  };

  /** Marks journeyStatus as SUBMITTED in the shared coAgent state so the backend guards new threads. */
  const setJourneyStatus = (status: string) => {
    setLocalHydrated(prev => ({
      fieldValues: prev?.fieldValues || state.fieldValues,
      selectedTab: prev?.selectedTab || state.selectedTab,
      journeyStatus: status,
    }));
    setState({ ...state, journeyStatus: status });
    syncStateToBackend(state.fieldValues, state.selectedTab, status);
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
    if (state.journeyStatus === "SUBMITTED") {
      window.dispatchEvent(new CustomEvent("show-already-submitted"));
      return;
    }
    setLocalHydrated({
      fieldValues: defaultFormState.fieldValues,
      selectedTab: defaultFormState.selectedTab,
      journeyStatus: "IN_PROGRESS",
    });
    setState(defaultFormState);
    if (threadId) {
      syncStateToBackend(defaultFormState.fieldValues, defaultFormState.selectedTab, "IN_PROGRESS");
    }
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
      if (state.journeyStatus === "SUBMITTED") {
        return "Application is already submitted and locked. Field updates are not permitted.";
      }
      if (!CONSENT_FIELD_IDS.includes(node_id) && node_id !== "selectedRequiredAmount" && !areAllConsentsChecked(state.fieldValues)) {
        window.dispatchEvent(new CustomEvent("show-consent-required"));
        return "Please do consent and declaration first then you can proceed further.";
      }
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
      if (state.journeyStatus === "SUBMITTED") {
        return "Application is already submitted and locked. Field updates are not permitted.";
      }
      if (Array.isArray(updates)) {
        const hasNonConsent = updates.some(
          (u: any) => !CONSENT_FIELD_IDS.includes(u.node_id || u.nodeId) && (u.node_id || u.nodeId) !== "selectedRequiredAmount"
        );
        if (hasNonConsent && !areAllConsentsChecked(state.fieldValues)) {
          window.dispatchEvent(new CustomEvent("show-consent-required"));
          return "Please do consent and declaration first then you can proceed further.";
        }
        updateMultipleFields(updates as any);
        return `Updated ${updates.length} fields successfully.`;
      }
      return "No updates provided.";
    },
  });

  useCopilotAction({
    name: "accept_all_consents",
    description: "Accepts all 3 consent and declaration checkboxes in Step 0 (Terms & Conditions, Lifestyle, Privacy)",
    parameters: [],
    handler: async () => {
      acceptAllConsents();
      return "All consents and declarations have been accepted. You can now proceed to fill your application.";
    },
  });

  useCopilotAction({
    name: "clear_field",
    description: "Clears or resets a form field value",
    parameters: [
      { name: "node_id", type: "string", description: "Target field node_id to clear" },
    ],
    handler: async ({ node_id }) => {
      if (state.journeyStatus === "SUBMITTED") {
        return "Application is already submitted and locked. Field updates are not permitted.";
      }
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
      if (tab_id !== "tab_consents" && !areAllConsentsChecked(state.fieldValues)) {
        window.dispatchEvent(new CustomEvent("show-consent-required"));
        return "Please do consent and declaration first then you can proceed further.";
      }
      setSelectedTab(tab_id);
      return `Switched to tab ${tab_id}`;
    },
  });

  return {
    state,
    setState,
    updateFieldValue,
    updateMultipleFields,
    acceptAllConsents,
    areAllConsentsChecked: () => areAllConsentsChecked(state.fieldValues),
    setSelectedTab,
    setSelectedNode,
    setJourneyStatus,
    resetForm,
    run,
    stop,
    running: running || state.isProcessing,
  };
}

