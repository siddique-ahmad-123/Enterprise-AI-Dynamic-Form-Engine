"""
Form Assistant Agent Shared State Definition.

Extends CopilotKitState (which provides `messages` and CopilotKit internals).
All field names use camelCase to match TypeScript frontend interfaces exactly.
"""

from typing import List, Dict, Any, Optional
from copilotkit import CopilotKitState


class FormAgentState(CopilotKitState):
    """
    The complete bidirectional shared state for the Dynamic Form Assistant.

    Synchronized via CopilotKit between:
    - Frontend React app (useCoAgent hook)
    - Node.js CopilotRuntime
    - FastAPI LangGraph agent
    """

    # ── Hierarchical Metadata Form Tree ────────────────────────
    formTree: Dict[str, Any]

    # ── Dynamic Map of field node_id -> current value ─────────
    fieldValues: Dict[str, Any]

    # ── Navigation & Selection State ──────────────────────────
    selectedTab: Optional[str]
    selectedNode: Optional[str]

    # ── Audit Trail & History ──────────────────────────────────
    conversationHistory: List[Dict[str, Any]]
    lastAction: Optional[Dict[str, Any]]
    pendingUpdates: Optional[Dict[str, Any]]

    # ── Status Flags ──────────────────────────────────────────
    isProcessing: bool
    error: Optional[str]
