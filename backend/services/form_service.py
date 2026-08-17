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

from models.form_models import IntentAnalysis, IntentType, SingleFieldUpdate
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
You are an expert Enterprise AI Dynamic Form Intent Classifier & Journey Controller.
Given a user instruction and a dynamic hierarchical form tree, classify the user's intent and extract all field updates, answers, or queries across ALL form tabs.

CRITICAL INSTRUCTIONS FOR MULTI-TAB EXTRACTIONS & CONVERSATIONAL FORM FILLING:
1. MULTIPLE FIELD UPDATES: The user instruction MAY CONTAIN MULTIPLE FIELD UPDATES in a single turn. Extract ALL requested field updates into the `updates` array!
2. TAB 0 (CONSENTS): If user confirms ("Yes", "I agree", "Accept"), map to agreement checkboxes: `isCheckedTermandCond`, `isCheckedLifestyle`, `isCheckedPrivacy` -> true.
3. TAB 1 (PERSONAL DETAILS & ADDRESS):
   - Extract Name (`borrowerName`), Date of Birth (`borrowerDOB`), Mobile (`borrowerMobileNo`), Email (`borrowerEmailId`).
   - Unstructured Address: Decompose address into `Address Line 1`, `Address Line 2`, `City`, `State`, `PIN Code`, `Country`.
4. TAB 2 (CO-BORROWER SELECTION):
   - If user says "No", "No co-borrower", "I don't need a co-borrower" -> map `isCoBorrower` to "No".
   - If user says "Yes" or provides co-borrower details -> map `isCoBorrower` to "Yes", `coBorrowerName`, `coBorrowerMobileNo`, `coBorrowerEidaNo`, etc.
5. TAB 3 (INCOME & EMPLOYMENT):
   - If user says "Salaried" or "Self-employed" -> map `borrowerIncomeType` to "Salaried" / "Self Employed".
   - Extract `borrowerEmployerName`, `borrowerEmployedFrom`, `borrowerCurrentExp`, `borrowerTotalExp`, `borrowerMonthlySalaryBankTransfer` / `borrowerMonthlySalaryAECB`.
6. TAB 4 (PRODUCT & LOAN):
   - Extract `loanType` (e.g. "Home Purchase Loan", "Refinance"), `purpose`, `loanAmount`, `tenure`, `rateOfInterest`.
   - Property details: `isPropertyIdentified` ("Yes"/"No"), `propertyAddressLine1`, `propertyEmirates`, `transactionAmount` (property valuation), `ownContribution` (down payment).
7. REVIEW & SUBMISSION:
   - "Review", "Review Application", "Show details" -> intent: `REVIEW_APPLICATION`.
   - "Submit", "Submit Application", "Confirm and submit" -> intent: `SUBMIT_APPLICATION`.

Intents:
- UPDATE_FIELD: User wants to change, set, update, fill, or enter values for one or more fields.
- CONFIRM_CONSENT: User confirms agreement/declarations in Step 0.
- REVIEW_APPLICATION: User wants to inspect or review the full application.
- SUBMIT_APPLICATION: User wants to finalize and submit the application.
- QUERY_FIELD: User asks what value a field has.
- CLEAR_FIELD: User asks to clear, reset, or remove a field value.
- NAVIGATE_TAB: User asks to go to or switch to a specific tab.
- SUMMARIZE_FORM: User asks for a summary or completion status.
- FIND_MISSING: User asks which fields are empty or required.
- PLOT_CHART: User asks to render a pie chart, bar chart, or graph.
- UNKNOWN: General conversation or unrelated greeting.

JSON Output Format (Strictly valid JSON):
{
    "intent": "UPDATE_FIELD",
    "target_field_query": "borrowerName",
    "target_tab_query": null,
    "target_value": "John Doe",
    "chart_type": null,
    "updates": [
        {"target_field_query": "borrowerName", "target_value": "John Doe"},
        {"target_field_query": "borrowerDOB", "target_value": "1995-05-15"},
        {"target_field_query": "borrowerMobileNo", "target_value": "+971501234567"}
    ],
    "reasoning": "Extracted personal details from conversational response"
}
"""


async def analyze_user_intent(
    user_text: str,
    form_tree: Dict[str, Any],
    field_values: Dict[str, Any]
) -> IntentAnalysis:
    """
    Analyzes the user's natural language input using LLM to extract intent,
    target field queries, target tab queries, and candidate values.
    Supports single and multi-field updates across all 6 tabs.
    """
    if not user_text:
        return IntentAnalysis(intent=IntentType.UNKNOWN)

    lower = user_text.lower().strip()

    # Consent fast check
    if lower in ["yes", "yep", "i agree", "agree", "accept", "sure", "ok", "confirm", "proceed", "yes i agree", "i accept", "terms", "agree with terms"]:
        is_consent_done = field_values.get("isCheckedTermandCond") and field_values.get("isCheckedLifestyle") and field_values.get("isCheckedPrivacy")
        if not is_consent_done:
            return IntentAnalysis(
                intent=IntentType.CONFIRM_CONSENT,
                updates=[
                    SingleFieldUpdate(target_field_query="isCheckedTermandCond", target_value=True),
                    SingleFieldUpdate(target_field_query="isCheckedLifestyle", target_value=True),
                    SingleFieldUpdate(target_field_query="isCheckedPrivacy", target_value=True),
                ],
                reasoning="Fast pattern match for consent agreement confirmation"
            )

    # Co-Borrower "No" fast check
    if lower in ["no", "no co-borrower", "no coborrower", "no co borrower", "dont add coborrower", "don't add co-borrower", "skip co-borrower", "single applicant"]:
        return IntentAnalysis(
            intent=IntentType.UPDATE_FIELD,
            target_field_query="isCoBorrower",
            target_value="No",
            updates=[
                SingleFieldUpdate(target_field_query="isCoBorrower", target_value="No")
            ],
            reasoning="Fast pattern match for single applicant / no co-borrower selection"
        )

    # Submit application fast check
    if any(k in lower for k in ["submit application", "submit my application", "final submit", "confirm submission", "complete application", "confirm and submit"]):
        return IntentAnalysis(
            intent=IntentType.SUBMIT_APPLICATION,
            reasoning="Fast pattern match for final application submission"
        )

    # Review stage fast check
    if any(k in lower for k in ["review application", "review my details", "show review", "check application", "open review", "review details"]):
        return IntentAnalysis(
            intent=IntentType.REVIEW_APPLICATION,
            reasoning="Fast pattern match for application review stage"
        )

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

    # LLM Intent Classifier for complex & multi-field commands
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

        # Build list of updates
        raw_updates = parsed.get("updates") or []
        updates_list = []
        for u in raw_updates:
            if isinstance(u, dict) and u.get("target_field_query"):
                updates_list.append(SingleFieldUpdate(
                    target_field_query=str(u.get("target_field_query")),
                    target_value=u.get("target_value")
                ))

        if not updates_list and parsed.get("target_field_query"):
            updates_list.append(SingleFieldUpdate(
                target_field_query=str(parsed.get("target_field_query")),
                target_value=parsed.get("target_value")
            ))

        return IntentAnalysis(
            intent=intent_enum,
            target_field_query=parsed.get("target_field_query") or (updates_list[0].target_field_query if updates_list else None),
            target_tab_query=parsed.get("target_tab_query"),
            target_value=parsed.get("target_value") if parsed.get("target_value") is not None else (updates_list[0].target_value if updates_list else None),
            chart_type=parsed.get("chart_type"),
            updates=updates_list,
            reasoning=parsed.get("reasoning"),
        )
    except Exception as e:
        logger.error("Intent analysis failed: %s", e, exc_info=True)
        # Try address fallback parser
        addr_updates = try_parse_address_fallback(user_text)
        if addr_updates:
            return IntentAnalysis(
                intent=IntentType.UPDATE_FIELD,
                target_field_query=addr_updates[0].target_field_query,
                target_value=addr_updates[0].target_value,
                updates=addr_updates,
                reasoning="Fallback regex parsed unstructured address string"
            )

        # Fallback multi-clause splitter
        if " to " in lower or " as " in lower or " is " in lower or " set " in lower or " update " in lower:
            field_q, val = split_set_command(user_text)
            if field_q:
                single_up = SingleFieldUpdate(target_field_query=field_q, target_value=val)
                return IntentAnalysis(
                    intent=IntentType.UPDATE_FIELD,
                    target_field_query=field_q,
                    target_value=val,
                    updates=[single_up],
                    reasoning="Fallback pattern split for UPDATE_FIELD"
                )

    return IntentAnalysis(intent=IntentType.UNKNOWN)


def try_parse_address_fallback(text: str) -> Optional[List[SingleFieldUpdate]]:
    """
    Fallback regex parser for raw address strings like:
    "Flat 402, Sunshine Apartments, MG Road, Andheri West, Mumbai, Maharashtra 400058, India"
    """
    import re
    # Remove leading "address:" prefix if present
    cleaned = re.sub(r'^(?:my address is|address is|address:|my address:)\s*', '', text, flags=re.IGNORECASE).strip()
    parts = [p.strip() for p in cleaned.split(",") if p.strip()]
    if len(parts) < 3:
        return None

    # Check for pin code (e.g. 5 or 6 digits) inside parts
    pincode_idx = -1
    state_name = None
    pin_val = None

    for idx, part in enumerate(parts):
        m = re.search(r'^(.*?)\s*(\b\d{5,6}\b)\s*$', part)
        if m:
            pincode_idx = idx
            state_name = m.group(1).strip() or None
            pin_val = m.group(2).strip()
            break

    if pincode_idx == -1:
        return None

    city_idx = pincode_idx - 1
    city_val = parts[city_idx] if city_idx >= 0 else None

    addr_parts = parts[:city_idx]
    if not addr_parts:
        return None

    if len(addr_parts) == 1:
        addr1 = addr_parts[0]
        addr2 = ""
    elif len(addr_parts) == 2:
        addr1 = addr_parts[0]
        addr2 = addr_parts[1]
    else:
        mid = len(addr_parts) // 2
        addr1 = ", ".join(addr_parts[:mid])
        addr2 = ", ".join(addr_parts[mid:])

    country_val = parts[-1] if len(parts) > pincode_idx + 1 else None

    updates = []
    if addr1:
        updates.append(SingleFieldUpdate(target_field_query="Address Line 1", target_value=addr1))
    if addr2:
        updates.append(SingleFieldUpdate(target_field_query="Address Line 2", target_value=addr2))
    if city_val:
        updates.append(SingleFieldUpdate(target_field_query="City", target_value=city_val))
    if state_name:
        updates.append(SingleFieldUpdate(target_field_query="State", target_value=state_name))
    if pin_val:
        updates.append(SingleFieldUpdate(target_field_query="PIN Code", target_value=pin_val))
    if country_val:
        updates.append(SingleFieldUpdate(target_field_query="Country", target_value=country_val))

    return updates if updates else None


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


import datetime

def calculate_derived_fields(field_values: Dict[str, Any]) -> Dict[str, Any]:
    """
    Automatically calculates derived fields such as age from Date of Birth.
    Returns dictionary of newly calculated derived field updates.
    """
    derived_updates = {}

    # Calculate Age from borrowerDOB
    dob = field_values.get("borrowerDOB")
    if dob and isinstance(dob, str) and dob.strip():
        try:
            birth_year = None
            if "-" in dob:
                parts = dob.split("-")
                if len(parts[0]) == 4:
                    birth_year = int(parts[0])
                elif len(parts) > 2 and len(parts[2]) == 4:
                    birth_year = int(parts[2])
            elif dob.isdigit() and len(dob) == 4:
                birth_year = int(dob)

            if birth_year:
                current_year = datetime.datetime.now().year
                calc_age = current_year - birth_year
                if 18 <= calc_age <= 100:
                    derived_updates["borrowerAge"] = calc_age
        except Exception as e:
            logger.debug("Failed to calculate age from DOB '%s': %s", dob, e)

    return derived_updates


TAB_JOURNEY_SEQUENCE = [
    "tab_consents",
    "tab_personal_borrower",
    "tab_personal_coborrower",
    "tab_income_borrower",
    "tab_product_loan",
    "tab_decision",
]


def check_tab_completed(tab_id: str, form_tree: Dict[str, Any], field_values: Dict[str, Any]) -> bool:
    """
    Checks if all required fields in the specified tab are filled, taking into account
    conditional section visibility.
    """
    tabs = get_all_tabs(form_tree)
    target_tab = None
    for tab in tabs:
        if tab.get("node_id") == tab_id:
            target_tab = tab
            break

    if not target_tab:
        return False

    # Special logic for Co-Borrower tab
    if tab_id == "tab_personal_coborrower":
        is_coborrower_val = field_values.get("isCoBorrower")
        if not is_coborrower_val or is_coborrower_val == "" or is_coborrower_val == "Select":
            return False
        if is_coborrower_val == "No":
            return True
        for fid in ["coBorrowerName", "coBorrowerMobileNo", "coBorrowerEidaNo"]:
            val = field_values.get(fid)
            if val is None or val == "" or val == "Select":
                return False
        return True

    def is_condition_met(node: Dict[str, Any]) -> bool:
        cond = node.get("condition")
        if not cond:
            return True
        if "===" in cond:
            parts = [p.strip().strip("'\"") for p in cond.split("===")]
            if len(parts) == 2:
                var_name, expected_val = parts[0], parts[1]
                return str(field_values.get(var_name, "")) == expected_val
        return True

    def check_node(node: Dict[str, Any]) -> bool:
        if not is_condition_met(node):
            return True  # Hidden container, required fields inside do not block

        if node.get("required") and not node.get("readonly") and node.get("node_type") in ("field", "upload", "segment"):
            nid = node.get("node_id")
            val = field_values.get(nid, node.get("value"))
            if val is None or val == "" or val is False or val == [] or val == "Select":
                return False

        children = node.get("children") or []
        for child in children:
            if not check_node(child):
                return False

        return True

    return check_node(target_tab)


def get_next_incomplete_tab(form_tree: Dict[str, Any], field_values: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Returns the next incomplete tab node in the progressive journey.
    """
    tabs = get_all_tabs(form_tree)
    tab_map = {t.get("node_id"): t for t in tabs}

    for tab_id in TAB_JOURNEY_SEQUENCE:
        if tab_id in tab_map and not check_tab_completed(tab_id, form_tree, field_values):
            return tab_map[tab_id]
    return None


def generate_review_summary(form_tree: Dict[str, Any], field_values: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """
    Renders an interactive Review Stage Summary Card and Markdown report
    presenting all collected details to the user for final confirmation.
    """
    fields = get_all_fields(form_tree)
    review_groups: Dict[str, List[Dict[str, Any]]] = {}

    for f in fields:
        nid = f.get("node_id")
        label = f.get("label", nid)
        path = f.get("path") or []
        tab_name = path[1] if len(path) > 1 else "General Information"
        val = field_values.get(nid, f.get("value"))

        if val is True:
            val_str = "Checked / Agreed"
        elif val is False:
            val_str = "Not Agreed"
        elif val is not None and str(val).strip() != "":
            val_str = str(val)
        else:
            val_str = "Not Provided"

        if tab_name not in review_groups:
            review_groups[tab_name] = []
        review_groups[tab_name].append({"label": label, "value": val_str, "node_id": nid})

    card_dict = {
        "card_type": "review_summary",
        "title": "📋 Application Journey Review",
        "subtitle": "Please review all collected details below before final submission.",
        "groups": [
            {
                "group_title": group_title,
                "fields": items
            }
            for group_title, items in review_groups.items()
        ]
    }

    lines = ["📋 **Application Journey Review Summary**\n"]
    lines.append("Please verify your application details below:\n")

    for group_title, items in review_groups.items():
        lines.append(f"### 📌 {group_title}")
        for item in items:
            val_disp = f"`{item['value']}`" if item['value'] != "Not Provided" else "*(empty)*"
            lines.append(f"• **{item['label']}**: {val_disp}")
        lines.append("")

    lines.append("💡 *If any detail is incorrect, simply let me know (e.g., \"My mobile number is wrong; change it to 9876543210\").*")
    lines.append("✨ *If everything looks correct, reply **\"Confirm\"** or **\"Submit Application\"** to complete your application.*")

    return card_dict, "\n".join(lines)

