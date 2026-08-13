"""
LangGraph nodes for the AI Dynamic Form Assistant pipeline.

Each node receives FormAgentState and a RunnableConfig, performs its discrete phase,
emits intermediate state updates to the React UI via `copilotkit_emit_state`,
and returns partial state updates.

Pipeline flow:
receive_request -> understand_intent -> traverse_tree -> locate_node -> validate_action -> update_shared_state -> generate_response
"""

import json
import logging
import datetime
from typing import Dict, Any, Optional, List
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import AIMessage, HumanMessage

from state.form_state import FormAgentState
from models.form_models import IntentType, IntentAnalysis
from services import (
    analyze_user_intent,
    find_field_by_query,
    find_tab_by_query,
    validate_and_cast_value,
    generate_form_summary,
    get_form_summary_data,
    generate_missing_fields_report,
    get_missing_fields_data,
    get_chart_analysis_data,
    get_all_tabs,
    get_all_fields,
    split_set_command,
)



logger = logging.getLogger(__name__)


async def _emit(config: RunnableConfig, partial_state: dict) -> None:
    """Safely emits intermediate state updates to the React UI."""
    try:
        from copilotkit.langgraph import copilotkit_emit_state
        await copilotkit_emit_state(config, partial_state)
    except Exception as e:
        logger.debug("copilotkit_emit_state unavailable: %s", e)


# ─────────────────────────────────────────────────────────────────
# Node 1: Receive User Request
# ─────────────────────────────────────────────────────────────────

async def receive_request_node(
    state: FormAgentState,
    config: RunnableConfig,
) -> dict:
    """
    Reads the latest user message from state['messages'].
    Sets `isProcessing = True` and emits to frontend immediately.
    """
    messages = state.get("messages", [])
    user_text = ""

    if messages:
        last = messages[-1]
        if isinstance(last, dict):
            role = last.get("role") or last.get("type")
            if role in ("user", "human"):
                user_text = str(last.get("content", "")).strip()
        elif hasattr(last, "content"):
            msg_type = getattr(last, "type", "")
            is_human = isinstance(last, HumanMessage) or msg_type in ("human", "user")
            if is_human and isinstance(last.content, str):
                user_text = last.content.strip()

    updates = {
        "isProcessing": True,
        "error": None,
        "pendingUpdates": {"user_instruction": user_text} if user_text else None
    }
    await _emit(config, updates)
    return updates


# ─────────────────────────────────────────────────────────────────
# Node 2: Understand Intent
# ─────────────────────────────────────────────────────────────────

async def understand_intent_node(
    state: FormAgentState,
    config: RunnableConfig,
) -> dict:
    """
    Classifies user intent (UPDATE_FIELD, QUERY_FIELD, NAVIGATE_TAB, SUMMARIZE_FORM, etc.)
    and extracts target queries and candidate values.
    """
    pending = state.get("pendingUpdates") or {}
    user_text = pending.get("user_instruction", "")

    if not user_text:
        return {"pendingUpdates": {**pending, "intent_analysis": IntentAnalysis(intent=IntentType.UNKNOWN).model_dump()}}

    form_tree = state.get("formTree") or {}
    field_values = state.get("fieldValues") or {}

    analysis = await analyze_user_intent(user_text, form_tree, field_values)
    logger.info("Analyzed intent: %s | Query: %s | Val: %s", analysis.intent, analysis.target_field_query, analysis.target_value)

    updated_pending = {
        **pending,
        "intent_analysis": analysis.model_dump()
    }
    return {"pendingUpdates": updated_pending}


# ─────────────────────────────────────────────────────────────────
# Node 3: Traverse Form Tree
# ─────────────────────────────────────────────────────────────────

async def traverse_tree_node(
    state: FormAgentState,
    config: RunnableConfig,
) -> dict:
    """
    Recursively walks the hierarchical form tree to find candidate node matches
    based on the extracted intent and target queries.
    """
    pending = state.get("pendingUpdates") or {}
    intent_data = pending.get("intent_analysis") or {}
    intent_type = intent_data.get("intent", IntentType.UNKNOWN)

    form_tree = state.get("formTree") or {}
    field_values = state.get("fieldValues") or {}

    field_match = None
    tab_match = None
    match_reason = ""
    confidence = 0.0

    target_field_q = intent_data.get("target_field_query")
    target_tab_q = intent_data.get("target_tab_query")

    if intent_type in (IntentType.UPDATE_FIELD, IntentType.QUERY_FIELD, IntentType.CLEAR_FIELD, IntentType.EXPLAIN_FIELD):
        if target_field_q:
            matched_node, confidence, match_reason = find_field_by_query(form_tree, target_field_q, field_values)
            field_match = matched_node

    elif intent_type == IntentType.NAVIGATE_TAB:
        if target_tab_q:
            tab_match = find_tab_by_query(form_tree, target_tab_q)

    updated_pending = {
        **pending,
        "field_match": field_match,
        "tab_match": tab_match,
        "confidence": confidence,
        "match_reason": match_reason,
    }
    return {"pendingUpdates": updated_pending}


# ─────────────────────────────────────────────────────────────────
# Node 4: Locate Target Node
# ─────────────────────────────────────────────────────────────────

async def locate_node_node(
    state: FormAgentState,
    config: RunnableConfig,
) -> dict:
    """
    Resolves the exact target node, checks node attributes (node_id, label, readonly, required).
    If a tab is target, updates `selectedTab`. If a field is target, selects node tab container.
    """
    pending = state.get("pendingUpdates") or {}
    field_match = pending.get("field_match")
    tab_match = pending.get("tab_match")

    selected_node = None
    selected_tab = state.get("selectedTab")

    if field_match:
        selected_node = field_match.get("node_id")
        # Try finding parent tab for field node to automatically switch tabs in UI
        path = field_match.get("path") or []
        form_tree = state.get("formTree") or {}
        tabs = get_all_tabs(form_tree)
        for tab in tabs:
            tab_label = tab.get("label", "")
            if tab_label in path:
                selected_tab = tab.get("node_id")
                break

    elif tab_match:
        selected_tab = tab_match.get("node_id")

    updated_pending = {
        **pending,
        "target_selected_node": selected_node,
        "target_selected_tab": selected_tab,
    }
    return {"pendingUpdates": updated_pending}


# ─────────────────────────────────────────────────────────────────
# Node 5: Validate Action
# ─────────────────────────────────────────────────────────────────

async def validate_action_node(
    state: FormAgentState,
    config: RunnableConfig,
) -> dict:
    """
    Validates proposed action against business rules:
    - READONLY CHECK: If node is readonly, marks validation_failed with clear message.
    - OPTIONS / TYPE CHECK: Validates proposed value against options list or type.
    """
    pending = state.get("pendingUpdates") or {}
    intent_data = pending.get("intent_analysis") or {}
    intent_type = intent_data.get("intent", IntentType.UNKNOWN)
    field_match = pending.get("field_match")
    target_val = intent_data.get("target_value")

    is_valid = True
    validation_error = None
    casted_val = target_val

    if intent_type == IntentType.UPDATE_FIELD and field_match:
        # Check Readonly status
        if field_match.get("readonly", False):
            is_valid = False
            field_label = field_match.get("label", "This field")
            validation_error = f"⚠️ **{field_label}** is read-only and cannot be modified."

        else:
            # Validate and cast value
            casted_val, err = validate_and_cast_value(field_match, target_val)
            if err:
                is_valid = False
                validation_error = err

    updated_pending = {
        **pending,
        "is_valid": is_valid,
        "validation_error": validation_error,
        "casted_value": casted_val,
    }
    return {"pendingUpdates": updated_pending}


# ─────────────────────────────────────────────────────────────────
# Node 6: Update Shared State
# ─────────────────────────────────────────────────────────────────

async def update_shared_state_node(
    state: FormAgentState,
    config: RunnableConfig,
) -> dict:
    """
    Mutates the shared state (fieldValues, selectedTab, selectedNode, lastAction)
    and streams immediate state updates to the React UI.
    """
    pending = state.get("pendingUpdates") or {}
    intent_data = pending.get("intent_analysis") or {}
    intent_type = intent_data.get("intent", IntentType.UNKNOWN)
    field_match = pending.get("field_match")
    is_valid = pending.get("is_valid", True)
    casted_val = pending.get("casted_value")

    field_values = dict(state.get("fieldValues") or {})
    selected_tab = pending.get("target_selected_tab") or state.get("selectedTab")
    selected_node = pending.get("target_selected_node") or state.get("selectedNode")
    last_action = state.get("lastAction")
    history = list(state.get("conversationHistory") or [])

    action_msg = ""

    if is_valid and intent_type == IntentType.UPDATE_FIELD and field_match:
        node_id = field_match.get("node_id")
        old_val = field_values.get(node_id)
        field_values[node_id] = casted_val
        field_label = field_match.get("label", node_id)

        action_msg = f"Updated '{field_label}' to '{casted_val}'"
        last_action = {
            "action_type": "UPDATE_FIELD",
            "node_id": node_id,
            "field_label": field_label,
            "old_value": old_val,
            "new_value": casted_val,
            "timestamp": datetime.datetime.now().isoformat(),
            "message": action_msg
        }
        history.append(last_action)

    elif is_valid and intent_type == IntentType.CLEAR_FIELD and field_match:
        node_id = field_match.get("node_id")
        old_val = field_values.get(node_id)
        field_values[node_id] = ""
        field_label = field_match.get("label", node_id)

        action_msg = f"Cleared field '{field_label}'"
        last_action = {
            "action_type": "CLEAR_FIELD",
            "node_id": node_id,
            "field_label": field_label,
            "old_value": old_val,
            "new_value": "",
            "timestamp": datetime.datetime.now().isoformat(),
            "message": action_msg
        }
        history.append(last_action)

    elif intent_type == IntentType.NAVIGATE_TAB:
        tab_match = pending.get("tab_match")
        if tab_match:
            selected_tab = tab_match.get("node_id")
            action_msg = f"Navigated to tab '{tab_match.get('label')}'"

    updates = {
        "fieldValues": field_values,
        "selectedTab": selected_tab,
        "selectedNode": selected_node,
        "lastAction": last_action,
        "conversationHistory": history,
        "isProcessing": False,
        "error": pending.get("validation_error"),
    }

    # Emit updated state immediately so React UI updates in real-time!
    await _emit(config, updates)
    return updates


# ─────────────────────────────────────────────────────────────────
# Node 7: Generate Response
# ─────────────────────────────────────────────────────────────────

async def generate_response_node(
    state: FormAgentState,
    config: RunnableConfig,
) -> dict:
    """
    Generates the final natural language AIMessage displayed in the CopilotKit chat,
    embedding structured Card UI data for rich visual rendering in the React UI.
    """
    pending = state.get("pendingUpdates") or {}
    intent_data = pending.get("intent_analysis") or {}
    intent_type = intent_data.get("intent", IntentType.UNKNOWN)
    validation_error = pending.get("validation_error")
    field_match = pending.get("field_match")
    tab_match = pending.get("tab_match")
    user_instruction = pending.get("user_instruction", "")

    form_tree = state.get("formTree") or {}
    field_values = state.get("fieldValues") or {}

    content = ""
    card_dict = None

    # Case 1: Validation error (e.g. Readonly field violation)
    if validation_error:
        label = field_match.get("label", "Field") if field_match else "Field"
        card_dict = {
            "card_type": "validation_error",
            "title": "Action Restricted",
            "field_label": label,
            "message": validation_error.replace("⚠️ ", "").replace("**", "")
        }
        content = validation_error

    # Case 2: Update Field successful
    elif intent_type == IntentType.UPDATE_FIELD and field_match:
        label = field_match.get("label")
        node_id = field_match.get("node_id")
        val = field_values.get(node_id)
        path = field_match.get("path", [])
        path_str = " -> ".join(path)

        card_dict = {
            "card_type": "update_success",
            "title": "Field Updated Successfully",
            "field_label": label,
            "new_value": str(val) if val is not None else "",
            "node_id": node_id,
            "path": path
        }
        content = (
            f"✅ **Updated Field Successfully!**\n\n"
            f"• **Field**: `{label}` (Location: *{path_str}*)\n"
            f"• **New Value**: `{val}`\n\n"
            f"*The form UI has been synchronized in real-time.*"
        )

    # Case 3: Clear Field
    elif intent_type == IntentType.CLEAR_FIELD and field_match:
        label = field_match.get("label")
        node_id = field_match.get("node_id")
        card_dict = {
            "card_type": "clear_field",
            "title": "Cleared Field",
            "field_label": label,
            "node_id": node_id
        }
        content = f"🧹 **Cleared Field**: `{label}` value has been reset."

    # Case 4: Query Field
    elif intent_type == IntentType.QUERY_FIELD and field_match:
        label = field_match.get("label")
        node_id = field_match.get("node_id")
        val = field_values.get(node_id, field_match.get("value"))
        val_display = f"`{val}`" if val is not None and val != "" else "*(empty)*"
        readonly_tag = " [READ-ONLY]" if field_match.get("readonly") else ""

        card_dict = {
            "card_type": "field_info",
            "title": f"Field Information: {label}",
            "field_label": label,
            "value": str(val) if val is not None else "",
            "node_id": node_id,
            "field_type": field_match.get("field_type", "text"),
            "readonly": field_match.get("readonly", False),
            "required": field_match.get("required", False)
        }
        content = f"🔍 **Field Information for '{label}'**{readonly_tag}:\n\n• **Current Value**: {val_display}\n• **Node ID**: `{node_id}`\n• **Field Type**: `{field_match.get('field_type', 'text')}`"

    # Case 5: Navigate Tab
    elif intent_type == IntentType.NAVIGATE_TAB:
        if tab_match:
            label = tab_match.get("label")
            node_id = tab_match.get("node_id")
            card_dict = {
                "card_type": "navigate_tab",
                "title": "Navigated to Tab",
                "tab_label": label,
                "node_id": node_id
            }
            content = f"📌 **Navigated to Tab**: Switched active tab to **{label}**."
        else:
            content = "⚠️ Could not locate the specified tab in the form."

    # Case 6: Form Summary
    elif intent_type == IntentType.SUMMARIZE_FORM:
        card_dict = get_form_summary_data(form_tree, field_values)
        content = generate_form_summary(form_tree, field_values)

    # Case 7: Find Missing Required Fields
    elif intent_type == IntentType.FIND_MISSING:
        card_dict = get_missing_fields_data(form_tree, field_values)
        content = generate_missing_fields_report(form_tree, field_values)

    # Case 8: Plot Chart Analysis (PieChart / BarChart)
    elif intent_type == IntentType.PLOT_CHART:
        ctype = intent_data.get("chart_type", "pie_chart")
        card_dict = get_chart_analysis_data(form_tree, field_values, chart_type=ctype)
        chart_title = card_dict.get("title", "Chart Analysis")
        content = f"📊 **{chart_title}**\n\n*Rendering real-time interactive visual graph...*"

    # Case 9: General fallback assistance
    else:
        card_dict = {
            "card_type": "help",
            "title": "AI Dynamic Form Assistant",
            "description": "I can understand and manipulate this entire dynamic form hierarchy. Select a quick command or type your prompt below:",
            "suggestions": [
                "Set Customer Name to John Doe",
                "Update KYC Status to Verified",
                "Change Risk Rating to High",
                "Navigate to Check Eligibility tab",
                "Show current Identity Type",
                "Which fields are empty?",
                "Summarize the form"
            ]
        }
        content = (
            "🤖 **AI Dynamic Form Assistant**\n\n"
            "I can understand and manipulate this entire dynamic form hierarchy. Try asking me:\n\n"
            "• *\"Set Customer Name to John Doe\"*\n"
            "• *\"Update KYC Status to Verified\"*\n"
            "• *\"Change Risk Rating to High\"*\n"
            "• *\"Navigate to Account Info tab\"*\n"
            "• *\"Show current Customer ID\"*\n"
            "• *\"Which fields are empty?\"*\n"
            "• *\"Summarize the form\"*"
        )

    final_text = content
    if card_dict:
        json_str = json.dumps(card_dict, indent=2)
        final_text = f"```json:card\n{json_str}\n```\n\n{content}"

    return {"messages": [AIMessage(content=final_text)], "isProcessing": False}

