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
    calculate_derived_fields,
    get_next_incomplete_tab,
    generate_review_summary,
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

# ─────────────────────────────────────────────────────────────────
# Node 3: Traverse Form Tree
# ─────────────────────────────────────────────────────────────────

async def traverse_tree_node(
    state: FormAgentState,
    config: RunnableConfig,
) -> dict:
    """
    Recursively walks the hierarchical form tree to find candidate node matches
    based on the extracted intent and target queries (single or multi-field).
    """
    pending = state.get("pendingUpdates") or {}
    intent_data = pending.get("intent_analysis") or {}
    intent_type = intent_data.get("intent", IntentType.UNKNOWN)

    form_tree = state.get("formTree") or {}
    field_values = state.get("fieldValues") or {}

    field_matches = []
    tab_match = None
    confidence = 0.0

    target_field_q = intent_data.get("target_field_query")
    target_tab_q = intent_data.get("target_tab_query")
    updates_list = intent_data.get("updates") or []

    if intent_type in (IntentType.UPDATE_FIELD, IntentType.QUERY_FIELD, IntentType.CLEAR_FIELD, IntentType.EXPLAIN_FIELD):
        if updates_list:
            for up in updates_list:
                fq = up.get("target_field_query") if isinstance(up, dict) else getattr(up, "target_field_query", None)
                fv = up.get("target_value") if isinstance(up, dict) else getattr(up, "target_value", None)
                if fq:
                    matched_node, conf, reason = find_field_by_query(form_tree, fq, field_values)
                    if matched_node:
                        field_matches.append({
                            "query": fq,
                            "target_value": fv,
                            "node": matched_node,
                            "confidence": conf,
                            "reason": reason
                        })
        elif target_field_q:
            matched_node, conf, reason = find_field_by_query(form_tree, target_field_q, field_values)
            if matched_node:
                field_matches.append({
                    "query": target_field_q,
                    "target_value": intent_data.get("target_value"),
                    "node": matched_node,
                    "confidence": conf,
                    "reason": reason
                })

    elif intent_type == IntentType.NAVIGATE_TAB:
        if target_tab_q:
            tab_match = find_tab_by_query(form_tree, target_tab_q)

    updated_pending = {
        **pending,
        "field_matches": field_matches,
        "tab_match": tab_match,
        "confidence": confidence,
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
    Resolves the exact target nodes, checks node attributes (node_id, label, readonly, required).
    If a tab is target, updates `selectedTab`. If fields are target, selects parent tab container.
    """
    pending = state.get("pendingUpdates") or {}
    field_matches = pending.get("field_matches") or []
    tab_match = pending.get("tab_match")

    selected_node = None
    selected_tab = state.get("selectedTab")

    if field_matches:
        first_match = field_matches[0].get("node") or {}
        selected_node = first_match.get("node_id")
        path = first_match.get("path") or []
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
    field_matches = pending.get("field_matches") or []

    validated_updates = []
    validation_errors = []

    if intent_type == IntentType.UPDATE_FIELD and field_matches:
        for item in field_matches:
            node = item.get("node") or {}
            raw_val = item.get("target_value")
            label = node.get("label", "Field")

            if node.get("readonly", False):
                validation_errors.append(f"⚠️ **{label}** is read-only and cannot be modified.")
            else:
                casted_val, err = validate_and_cast_value(node, raw_val)
                if err:
                    validation_errors.append(err)
                else:
                    validated_updates.append({
                        "node": node,
                        "node_id": node.get("node_id"),
                        "field_label": label,
                        "query": item.get("query"),
                        "raw_value": raw_val,
                        "target_value": casted_val,
                        "value": casted_val,
                        "casted_value": casted_val
                    })

    is_valid = len(validated_updates) > 0 and len(validation_errors) == 0

    updated_pending = {
        **pending,
        "is_valid": is_valid,
        "validated_updates": validated_updates,
        "validation_errors": validation_errors,
    }
    return {"pendingUpdates": updated_pending}


# ─────────────────────────────────────────────────────────────────
# Node 6: Update Shared State
# ─────────────────────────────────────────────────────────────────

from mcp.tools import (
    mcp_analyze_form_tree,
    mcp_get_journey_step,
    mcp_update_form_fields,
    mcp_generate_review_data,
    mcp_submit_application,
)

# ─────────────────────────────────────────────────────────────────
# Node 6: Update Shared State
# ─────────────────────────────────────────────────────────────────

async def update_shared_state_node(
    state: FormAgentState,
    config: RunnableConfig,
) -> dict:
    """
    Mutates the shared state (fieldValues, selectedTab, selectedNode, lastAction)
    via the MCP Tools Layer and streams immediate state updates to the React UI.
    """
    pending = state.get("pendingUpdates") or {}
    intent_data = pending.get("intent_analysis") or {}
    intent_type = intent_data.get("intent", IntentType.UNKNOWN)
    field_matches = pending.get("field_matches") or []
    validated_updates = pending.get("validated_updates") or []

    form_tree = state.get("formTree") or {}
    field_values = dict(state.get("fieldValues") or {})
    selected_tab = pending.get("target_selected_tab") or state.get("selectedTab")
    selected_node = pending.get("target_selected_node") or state.get("selectedNode")
    last_action = state.get("lastAction")
    history = list(state.get("conversationHistory") or [])

    successful_updates = []
    validation_errors = list(pending.get("validation_errors") or [])

    # Case 1: Consent Confirmation
    if intent_type == IntentType.CONFIRM_CONSENT:
        consent_updates = [
            {"node_id": "isCheckedTermandCond", "target_value": True, "node": {"node_id": "isCheckedTermandCond", "label": "Terms & Conditions"}},
            {"node_id": "isCheckedLifestyle", "target_value": True, "node": {"node_id": "isCheckedLifestyle", "label": "Lifestyle Verification"}},
            {"node_id": "isCheckedPrivacy", "target_value": True, "node": {"node_id": "isCheckedPrivacy", "label": "Privacy Notice"}},
        ]
        field_values, succ, errs = mcp_update_form_fields(form_tree, field_values, consent_updates)
        successful_updates.extend(succ)
        validation_errors.extend(errs)

    # Case 2: Field Updates
    elif intent_type == IntentType.UPDATE_FIELD and validated_updates:
        field_values, succ, errs = mcp_update_form_fields(form_tree, field_values, validated_updates)
        successful_updates.extend(succ)
        validation_errors.extend(errs)

        for up in succ:
            act = {
                "action_type": "UPDATE_FIELD",
                "node_id": up.get("node_id"),
                "field_label": up.get("field_label"),
                "old_value": up.get("old_value"),
                "new_value": up.get("new_value"),
                "timestamp": datetime.datetime.now().isoformat(),
                "message": f"Updated '{up.get('field_label')}' to '{up.get('new_value')}'"
            }
            history.append(act)
            last_action = act

    # Case 3: Clear Field
    elif intent_type == IntentType.CLEAR_FIELD and field_matches:
        for item in field_matches:
            node = item.get("node") or {}
            node_id = node.get("node_id")
            old_val = field_values.get(node_id)
            field_values[node_id] = ""
            field_label = node.get("label", node_id)

            act = {
                "action_type": "CLEAR_FIELD",
                "node_id": node_id,
                "field_label": field_label,
                "old_value": old_val,
                "new_value": "",
                "timestamp": datetime.datetime.now().isoformat(),
                "message": f"Cleared field '{field_label}'"
            }
            history.append(act)
            last_action = act

    # Set selected_node to list of all modified node IDs for multi-field AI focus highlighting
    if successful_updates:
        selected_node = [u.get("node_id") for u in successful_updates if u.get("node_id")]
    elif intent_type == IntentType.CLEAR_FIELD and field_matches:
        selected_node = [m.get("node", {}).get("node_id") for m in field_matches if m.get("node", {}).get("node_id")]

    # ── MCP Journey Progression & Active Step Evaluation ──────────
    journey_info = mcp_get_journey_step(form_tree, field_values)
    journey_status = journey_info.get("journey_status", "IN_PROGRESS")
    
    if journey_info.get("active_tab_id"):
        selected_tab = journey_info.get("active_tab_id")

    if intent_type == IntentType.SUBMIT_APPLICATION:
        journey_status = "SUBMITTED"

    updated_pending = {
        **pending,
        "successful_updates": successful_updates,
        "journey_status": journey_status,
        "journey_info": journey_info,
        "validation_errors": validation_errors,
    }

    updates = {
        "fieldValues": field_values,
        "selectedTab": selected_tab,
        "selectedNode": selected_node,
        "lastAction": last_action,
        "conversationHistory": history,
        "journeyStatus": journey_status,
        "isProcessing": False,
        "pendingUpdates": updated_pending,
        "error": "\n".join(validation_errors),
    }

    # Stream state to React UI in real-time!
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
    validation_errors = pending.get("validation_errors") or []
    field_matches = pending.get("field_matches") or []
    tab_match = pending.get("tab_match")
    successful_updates = pending.get("successful_updates") or []
    journey_status = pending.get("journey_status", "IN_PROGRESS")
    journey_info = pending.get("journey_info") or {}

    form_tree = state.get("formTree") or {}
    field_values = state.get("fieldValues") or {}

    content = ""
    card_dict = None

    # Case 1: Consent Confirmation
    if intent_type == IntentType.CONFIRM_CONSENT:
        next_step = journey_info.get("step_title", "Step 1: Personal Details – Borrower")
        next_prompt = journey_info.get("step_prompt", "")
        next_desc = journey_info.get("step_description", "")

        card_dict = {
            "card_type": "update_success",
            "title": "Agreement Declarations Confirmed",
            "field_label": "Consents & Declarations",
            "new_value": "Agreed (Terms, Lifestyle, Privacy)",
            "path": ["Consents & Declarations"]
        }
        content = (
            "✅ **Consents & Agreement Declarations Confirmed!**\n\n"
            "I have updated the agreement checkboxes in your application form. "
            f"We have automatically progressed to **{next_step}**.\n\n"
            f"*{next_desc}*\n\n"
            f"{next_prompt}"
        )

    # Case 2: Final Submission Request
    elif intent_type == IntentType.SUBMIT_APPLICATION or journey_status == "SUBMITTED":
        card_dict = mcp_submit_application(form_tree, field_values)
        app_ref = card_dict.get("reference_id", "APP-2026-XXXXX")
        content = (
            f"🎉 **Application Submitted Successfully!**\n\n"
            f"• **Application Reference**: `{app_ref}`\n"
            f"• **Applicant**: `{field_values.get('borrowerName') or 'Applicant'}`\n"
            f"• **Status**: `Underwriting Sanction Review`\n"
            f"• **Timestamp**: `{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}`\n\n"
            f"Thank you! Your mortgage loan application has been recorded. Our credit underwriting officer will contact you shortly."
        )

    # Case 3: Review Stage Request or Form Complete
    elif intent_type == IntentType.REVIEW_APPLICATION or journey_status == "REVIEW":
        card_dict = mcp_generate_review_data(form_tree, field_values)
        content = (
            "📋 **Application Journey Review Stage**\n\n"
            "All sections of your application have been completed! You can inspect and modify any field across all tabs in the **Single-Page Review Popup**.\n\n"
            "• Click the button on the card below to **Open Single-Page Review & Edit Popup**\n"
            "• Or conversationally say: *\"Change my mobile number to 9876543210\"*\n"
            "• When ready, reply **\"Submit Application\"** to finalize!"
        )

    # Case 4: Field Updates across any Tab
    elif intent_type == IntentType.UPDATE_FIELD and successful_updates:
        lines = [f"✅ **Updated {len(successful_updates)} Field(s) Successfully!**\n"]
        has_derived = False

        for item in successful_updates:
            lines.append(f"• **{item['field_label']}**: `{item['new_value']}`")
            if item.get("is_derived"):
                has_derived = True

        if has_derived:
            lines.append("\n💡 *Derived fields (e.g. Age from Date of Birth) were calculated automatically.*")

        lines.append("\n*Form UI synchronized in real-time.*")

        if journey_status == "REVIEW":
            lines.append("\n🎉 **All required sections are complete!**")
            lines.append("👉 *Review your application in the **Single-Page Review Popup** or reply **\"Submit Application\"**.*")
            card_dict = mcp_generate_review_data(form_tree, field_values)
        else:
            step_title = journey_info.get("step_title", "")
            step_prompt = journey_info.get("step_prompt", "")
            step_desc = journey_info.get("step_description", "")
            if step_title:
                lines.append(f"\n📌 **Next Step: {step_title}**")
                if step_desc:
                    lines.append(f"*{step_desc}*")
                if step_prompt:
                    lines.append(f"\n{step_prompt}")

            first_up = successful_updates[0]
            card_dict = {
                "card_type": "update_success",
                "title": f"Updated {len(successful_updates)} Field(s) Successfully" if len(successful_updates) > 1 else "Field Updated Successfully",
                "field_label": first_up["field_label"],
                "new_value": str(first_up["new_value"]),
                "updated_fields": [
                    {"field_label": u["field_label"], "new_value": str(u["new_value"]), "node_id": u.get("node_id")}
                    for u in successful_updates
                ]
            }

        content = "\n".join(lines)
        if validation_errors:
            content += "\n\n" + "\n".join(validation_errors)

    # Case 5: Validation errors (e.g. read-only fields)
    elif validation_errors:
        err_msg = "\n".join(validation_errors)
        card_dict = {
            "card_type": "validation_error",
            "title": "Action Restricted",
            "message": err_msg.replace("⚠️ ", "").replace("**", "")
        }
        content = err_msg

    # Case 6: Clear Field
    elif intent_type == IntentType.CLEAR_FIELD and field_matches:
        match_labels = [m.get("node", {}).get("label", "Field") for m in field_matches]
        card_dict = {
            "card_type": "clear_field",
            "title": "Cleared Field(s)",
            "field_label": ", ".join(match_labels)
        }
        content = f"🧹 **Cleared Field(s)**: `{', '.join(match_labels)}` values have been reset."

    # Case 7: Query Field
    elif intent_type == IntentType.QUERY_FIELD and field_matches:
        match_info = []
        for m in field_matches:
            node = m.get("node") or {}
            lbl = node.get("label", "Field")
            nid = node.get("node_id")
            val = field_values.get(nid, node.get("value"))
            val_disp = f"`{val}`" if val is not None and val != "" else "*(empty)*"
            match_info.append(f"• **{lbl}**: {val_disp}")

        first_node = field_matches[0].get("node") or {}
        card_dict = {
            "card_type": "field_info",
            "title": f"Field Information: {first_node.get('label')}",
            "field_label": first_node.get("label"),
            "value": str(field_values.get(first_node.get("node_id"), "")),
            "node_id": first_node.get("node_id"),
            "field_type": first_node.get("field_type", "text"),
            "readonly": first_node.get("readonly", False),
            "required": first_node.get("required", False)
        }
        content = "🔍 **Field Information Query**:\n\n" + "\n".join(match_info)

    # Case 8: Navigate Tab
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

    # Case 9: Form Summary
    elif intent_type == IntentType.SUMMARIZE_FORM:
        card_dict = get_form_summary_data(form_tree, field_values)
        content = generate_form_summary(form_tree, field_values)

    # Case 10: Find Missing Required Fields
    elif intent_type == IntentType.FIND_MISSING:
        card_dict = get_missing_fields_data(form_tree, field_values)
        content = generate_missing_fields_report(form_tree, field_values)

    # Case 11: Plot Chart Analysis (PieChart / BarChart)
    elif intent_type == IntentType.PLOT_CHART:
        ctype = intent_data.get("chart_type", "pie_chart")
        card_dict = get_chart_analysis_data(form_tree, field_values, chart_type=ctype)
        chart_title = card_dict.get("title", "Chart Analysis")
        content = f"📊 **{chart_title}**\n\n*Rendering real-time interactive visual graph...*"

    # Case 12: Proactive Initial Journey Greeting / Fallback
    else:
        journey_info = mcp_get_journey_step(form_tree, field_values)
        step_title = journey_info.get("step_title", "Step 0: Consents & Declarations")
        step_desc = journey_info.get("step_description", "")
        step_prompt = journey_info.get("step_prompt", "")

        card_dict = {
            "card_type": "help",
            "title": "Welcome to UAE Mortgage Application System",
            "description": "Let's complete your application step-by-step.",
            "suggestions": [
                "Yes, I agree to the terms and declarations",
                "My name is John Doe, DOB 1995-05-15, mobile +971501234567",
                "Flat 402, Sunshine Apartments, MG Road, Andheri West, Mumbai, Maharashtra 400058, India",
                "No co-borrower",
                "I am Salaried at Emaar Properties, salary 45000",
                "Home Purchase Loan, Amount 2500000, Tenure 240",
                "Review application",
                "Submit application"
            ]
        }
        content = (
            "👋 **Welcome to the UAE Mortgage Application System!**\n\n"
            "I am your AI Dynamic Form Assistant. I will guide you through all steps of your application.\n\n"
            f"📋 **{step_title}**\n"
            f"{step_desc}\n\n"
            f"{step_prompt}"
        )

    final_text = content
    if card_dict:
        json_str = json.dumps(card_dict, indent=2)
        final_text = f"```json:card\n{json_str}\n```\n\n{content}"

    return {"messages": [AIMessage(content=final_text)], "isProcessing": False}


