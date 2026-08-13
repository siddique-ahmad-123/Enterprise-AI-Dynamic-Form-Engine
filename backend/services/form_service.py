"""
Form AI Service logic.

Uses ChatOpenAI with structured output / prompt reasoning to parse natural language instructions,
understand user intent, validate form actions, and generate intelligent responses.
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List, Tuple
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from models.form_models import IntentAnalysis, IntentType
from services.tree_traversal import (
    format_tree_as_markdown,
    get_all_fields,
    get_all_tabs,
    find_field_by_query,
    find_tab_by_query,
)

logger = logging.getLogger(__name__)


def get_llm() -> ChatOpenAI:
    """Returns initialized OpenAI model instance."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    model_name = os.getenv("OPENAI_MODEL", "gpt-4o")
    return ChatOpenAI(
        api_key=api_key,
        model_name=model_name,
        temperature=0.1,
    )


INTENT_SYSTEM_PROMPT = """
You are an expert AI Form Engine Intent Classifier.
Given a user instruction and a simplified list of form fields and tabs, classify the user's intent and extract target details.

Intents:
- UPDATE_FIELD: User wants to change, set, update, fill, or enter a value for a field.
- QUERY_FIELD: User asks what value a field has, or asks to show/display a field value.
- CLEAR_FIELD: User asks to clear, reset, or remove a field value.
- NAVIGATE_TAB: User asks to go to, open, switch to, or navigate to a specific tab/section.
- SUMMARIZE_FORM: User asks for a summary of the form, completion status, or overview.
- FIND_MISSING: User asks which fields are empty, missing, or required.
- EXPLAIN_FIELD: User asks for an explanation or description of a field or concept.
- UNKNOWN: General conversation or unrelated request.

JSON Output Format (Strictly valid JSON):
{
    "intent": "UPDATE_FIELD",
    "target_field_query": "Customer Name",
    "target_tab_query": null,
    "target_value": "John Doe",
    "reasoning": "User explicitly asked to set Customer Name to John Doe"
}
"""


async def analyze_user_intent(
    user_text: str,
    form_tree: Dict[str, Any],
    field_values: Dict[str, Any]
) -> IntentAnalysis:
    """
    Analyzes the user's natural language input using LLM to extract intent,
    target field query, target tab query, and target value.
    """
    if not user_text:
        return IntentAnalysis(intent=IntentType.UNKNOWN)

    lower = user_text.lower().strip()

    # Chart / Graph plot fast check
    if any(k in lower for k in ["pie chart", "bar chart", "chart", "plot", "graph", "visualize"]):
        ctype = "bar_chart" if "bar" in lower else "pie_chart"
        return IntentAnalysis(
            intent=IntentType.PLOT_CHART,
            chart_type=ctype,
            reasoning="Fast pattern match for chart visualization request"
        )


    # Tab navigation fast check
    if lower.startswith(("navigate to", "go to", "open tab", "switch to tab", "show tab")):
        tab_name = re_extract_target(lower, ["navigate to tab", "navigate to", "go to tab", "go to", "open tab", "switch to tab", "show tab"])
        return IntentAnalysis(
            intent=IntentType.NAVIGATE_TAB,
            target_tab_query=tab_name,
            reasoning="Fast pattern match for tab navigation"
        )

    # Missing fields fast check
    if "missing" in lower or "empty" in lower or "required fields" in lower:
        return IntentAnalysis(
            intent=IntentType.FIND_MISSING,
            reasoning="Fast pattern match for missing required fields"
        )

    # Summary fast check
    if "summarize" in lower or "summary" in lower or "overview" in lower:
        return IntentAnalysis(
            intent=IntentType.SUMMARIZE_FORM,
            reasoning="Fast pattern match for form summary"
        )

    # Clear field fast check
    if lower.startswith(("clear ", "reset ", "blank ")) and not lower.startswith("clear form"):
        field_query = re_extract_target(lower, ["clear ", "reset ", "blank "])
        return IntentAnalysis(
            intent=IntentType.CLEAR_FIELD,
            target_field_query=field_query,
            reasoning="Fast pattern match for field clearing"
        )

    # LLM Intent Classifier for complex commands

    try:
        llm = get_llm()
        tree_context = format_tree_as_markdown(form_tree, field_values)

        messages = [
            SystemMessage(content=INTENT_SYSTEM_PROMPT),
            HumanMessage(content=f"Form Hierarchy:\n{tree_context}\n\nUser Instruction: {user_text}")
        ]

        response = await llm.ainvoke(messages)
        content = response.content.strip()

        # Extract JSON from markdown codeblock if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        parsed = json.loads(content)
        intent_str = parsed.get("intent", "UNKNOWN").upper()

        try:
            intent_enum = IntentType(intent_str)
        except ValueError:
            intent_enum = IntentType.UNKNOWN

        return IntentAnalysis(
            intent=intent_enum,
            target_field_query=parsed.get("target_field_query"),
            target_tab_query=parsed.get("target_tab_query"),
            target_value=parsed.get("target_value"),
            reasoning=parsed.get("reasoning"),
        )
    except Exception as e:
        logger.error("Intent analysis failed: %s", e, exc_info=True)
        # Fallback to direct field matching if user text contains "set X to Y" or "update X as Y"
        if " to " in lower or " as " in lower or " set " in lower or " change " in lower or " update " in lower:
            field_q, val = split_set_command(user_text)
            if field_q:
                return IntentAnalysis(
                    intent=IntentType.UPDATE_FIELD,
                    target_field_query=field_q,
                    target_value=val,
                    reasoning="Fallback pattern split for UPDATE_FIELD"
                )
        return IntentAnalysis(intent=IntentType.UNKNOWN)


def re_extract_target(text: str, prefixes: List[str]) -> str:
    """Strips common command prefixes to extract target string."""
    res = text
    for p in prefixes:
        if res.startswith(p):
            res = res[len(p):].strip()
            break
    return res.strip(" '\"")


def split_set_command(text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Parses commands like:
    - "Set Customer Name to John Doe" -> ("Customer Name", "John Doe")
    - "Update Customer ID as CUST10293" -> ("Customer ID", "CUST10293")
    - "Change Risk Rating to High" -> ("Risk Rating", "High")
    """
    raw = text.strip()
    # Match pattern: (set/update/change) <field> (to/as/=) <value>
    import re
    match = re.search(r'^(?:set|update|change|put)\s+(.+?)\s+(?:to|as|=)\s+(.+)$', raw, re.IGNORECASE)
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return None, None


def validate_and_cast_value(field_node: Dict[str, Any], raw_value: Any) -> Tuple[Any, Optional[str]]:
    """
    Validates a proposed value against the field definition.
    Checks field_type and valid options.
    Returns (cast_value, error_message).
    """
    if raw_value is None:
        return None, None

    field_type = field_node.get("field_type", "text")
    options = field_node.get("options") or []
    label = field_node.get("label", "Field")

    # If options specified (select/radio), check if raw_value matches an option (case-insensitive)
    if options:
        str_val = str(raw_value).strip()
        matched_option = None
        for opt in options:
            if opt.lower() == str_val.lower():
                matched_option = opt
                break
        if matched_option:
            return matched_option, None
        else:
            return None, f"'{raw_value}' is not a valid option for {label}. Valid options are: {', '.join(options)}"

    # Type casting
    if field_type == "number":
        try:
            if isinstance(raw_value, str) and "." in raw_value:
                return float(raw_value), None
            return int(raw_value), None
        except (ValueError, TypeError):
            return None, f"Value '{raw_value}' is not a valid number for {label}."

    if field_type in ("switch", "checkbox"):
        if isinstance(raw_value, bool):
            return raw_value, None
        str_v = str(raw_value).lower().strip()
        if str_v in ("true", "yes", "1", "on", "enable", "verified", "active"):
            return True, None
        if str_v in ("false", "no", "0", "off", "disable", "unverified", "inactive"):
            return False, None

    return str(raw_value), None


def get_form_summary_data(form_tree: Dict[str, Any], field_values: Dict[str, Any]) -> Dict[str, Any]:
    """Returns structured data for form summary card rendering."""
    fields = get_all_fields(form_tree)
    if not fields:
        return {
            "card_type": "form_summary",
            "total_fields": 0,
            "filled_fields": 0,
            "percentage": 0,
            "readonly_fields": 0,
            "field_items": [],
            "missing_required": []
        }

    total_fields = len(fields)
    filled_fields = 0
    readonly_fields = 0
    missing_required = []
    field_items = []

    for f in fields:
        node_id = f.get("node_id", "")
        label = f.get("label", node_id)
        val = field_values.get(node_id, f.get("value"))
        readonly = f.get("readonly", False)
        required = f.get("required", False)

        if readonly:
            readonly_fields += 1

        is_empty = val is None or val == "" or val == []

        if not is_empty:
            filled_fields += 1
            field_items.append({"node_id": node_id, "label": label, "value": str(val), "readonly": readonly})
        else:
            if required:
                missing_required.append(label)

    pct = int((filled_fields / total_fields) * 100) if total_fields > 0 else 0
    return {
        "card_type": "form_summary",
        "total_fields": total_fields,
        "filled_fields": filled_fields,
        "readonly_fields": readonly_fields,
        "percentage": pct,
        "field_items": field_items,
        "missing_required": missing_required
    }


def generate_form_summary(form_tree: Dict[str, Any], field_values: Dict[str, Any]) -> str:
    """Generates a complete natural language summary of form values and completion."""
    fields = get_all_fields(form_tree)
    if not fields:
        return "The form is empty."

    total_fields = len(fields)
    filled_fields = 0
    readonly_fields = 0
    missing_required = []
    summary_lines = []

    for f in fields:
        node_id = f.get("node_id", "")
        label = f.get("label", node_id)
        val = field_values.get(node_id, f.get("value"))
        readonly = f.get("readonly", False)
        required = f.get("required", False)

        if readonly:
            readonly_fields += 1

        is_empty = val is None or val == "" or val == []

        if not is_empty:
            filled_fields += 1
            summary_lines.append(f"• **{label}**: `{val}`")
        else:
            if required:
                missing_required.append(label)

    pct = int((filled_fields / total_fields) * 100) if total_fields > 0 else 0
    output = [
        f"📊 **Form Summary** ({filled_fields}/{total_fields} fields completed - {pct}%)\n",
        "**Current Field Values:**"
    ]
    output.extend(summary_lines if summary_lines else ["*(No fields filled yet)*"])

    if missing_required:
        output.append(f"\n⚠️ **Missing Required Fields ({len(missing_required)}):**")
        for req in missing_required:
            output.append(f"• {req}")
    else:
        output.append("\n✅ All mandatory fields have been satisfied!")

    return "\n".join(output)


def get_missing_fields_data(form_tree: Dict[str, Any], field_values: Dict[str, Any]) -> Dict[str, Any]:
    """Returns structured dictionary for missing fields analysis."""
    fields = get_all_fields(form_tree)
    missing_required = []
    empty_optional = []

    for f in fields:
        node_id = f.get("node_id", "")
        label = f.get("label", node_id)
        val = field_values.get(node_id, f.get("value"))
        required = f.get("required", False)
        readonly = f.get("readonly", False)

        is_empty = val is None or val == "" or val == []
        if is_empty and not readonly:
            if required:
                missing_required.append(label)
            else:
                empty_optional.append(label)

    return {
        "card_type": "missing_fields",
        "missing_required": missing_required,
        "empty_optional": empty_optional
    }


def generate_missing_fields_report(form_tree: Dict[str, Any], field_values: Dict[str, Any]) -> str:
    """Returns a list of empty fields with focus on required fields."""
    fields = get_all_fields(form_tree)
    missing_required = []
    empty_optional = []

    for f in fields:
        node_id = f.get("node_id", "")
        label = f.get("label", node_id)
        val = field_values.get(node_id, f.get("value"))
        required = f.get("required", False)
        readonly = f.get("readonly", False)

        is_empty = val is None or val == "" or val == []
        if is_empty and not readonly:
            if required:
                missing_required.append(f"🔴 **{label}** (Required)")
            else:
                empty_optional.append(f"⚪ **{label}** (Optional)")

    if not missing_required and not empty_optional:
        return "🎉 Great news! All fields in the form are completely filled."

    res = ["📋 **Field Completion Analysis**\n"]
    if missing_required:
        res.append(f"**Required Fields Needing Attention ({len(missing_required)}):**")
        res.extend(missing_required)
        res.append("")

    if empty_optional:
        res.append(f"**Empty Optional Fields ({len(empty_optional)}):**")
        res.extend(empty_optional)

    return "\n".join(res)


def get_chart_analysis_data(form_tree: Dict[str, Any], field_values: Dict[str, Any], chart_type: str = "pie_chart") -> Dict[str, Any]:
    """Generates structured chart dataset for real-time PieChart or BarChart visualization."""
    fields = get_all_fields(form_tree)
    filled_count = 0
    missing_req_count = 0
    empty_opt_count = 0
    field_types = {}

    for f in fields:
        node_id = f.get("node_id", "")
        val = field_values.get(node_id, f.get("value"))
        required = f.get("required", False)
        readonly = f.get("readonly", False)
        ftype = str(f.get("field_type", "text")).capitalize()

        field_types[ftype] = field_types.get(ftype, 0) + 1

        is_empty = val is None or val == "" or val == []
        if not is_empty:
            filled_count += 1
        else:
            if required:
                missing_req_count += 1
            else:
                empty_opt_count += 1

    if "bar" in str(chart_type).lower():
        data = [{"label": k, "value": v} for k, v in field_types.items()]
        return {
            "card_type": "bar_chart",
            "title": "Form Field Type Breakdown (Bar Chart)",
            "description": f"Distribution across {len(fields)} fields by data type.",
            "data": data
        }
    else:
        data = [
            {"label": "Filled Fields", "value": filled_count},
            {"label": "Missing Required", "value": missing_req_count},
            {"label": "Optional Empty", "value": empty_opt_count},
        ]
        return {
            "card_type": "pie_chart",
            "title": "Form Completion Analysis (Pie Chart)",
            "description": f"Real-time completion status across {len(fields)} total form fields.",
            "data": data
        }

