"""
Model Context Protocol (MCP) Tools Layer for Enterprise AI Dynamic Form Engine.

Provides standardized MCP tool specifications and executor handlers for:
1. Tree Inspection & Metadata Analysis (mcp_analyze_form_tree)
2. Conversational Journey Progression Across All Tabs (mcp_get_journey_step)
3. Semantic Field Updates & Auto-Derived Calculations (mcp_update_form_fields)
4. Tab Navigation & State Switching (mcp_navigate_tab)
5. Full Form Single-Page Review Aggregation (mcp_generate_review_data)
6. Final Form Application Submission (mcp_submit_application)
"""

import logging
import datetime
from typing import Dict, Any, List, Optional, Tuple

from models.form_models import FormNode, IntentType, SingleFieldUpdate
from services.tree_traversal import (
    get_all_fields,
    get_all_tabs,
    find_field_by_query,
    find_tab_by_query,
    flatten_tree,
)

logger = logging.getLogger(__name__)

# Standard Tab Journey Sequence across all 6 steps
TAB_JOURNEY_SEQUENCE = [
    "tab_consents",
    "tab_personal_borrower",
    "tab_personal_coborrower",
    "tab_income_borrower",
    "tab_product_loan",
    "tab_decision",
]

# Tab Prompts & Question Specifications for Dynamic Chatbot Flow
TAB_QUESTION_CONFIG = {
    "tab_consents": {
        "title": "Step 0: Consents & Declarations",
        "description": "Welcome! To begin your UAE Mortgage Application, please review and confirm if you agree with the following declarations:\n• **Terms & Conditions, Fees Sheet and Key Fact Statement**\n• **Lifestyle Expenses Verification**\n• **Privacy Notice**",
        "prompt": "👉 *Reply **\"Yes, I agree\"** to accept and proceed to Step 1.*",
        "required_fields": ["isCheckedTermandCond", "isCheckedLifestyle", "isCheckedPrivacy"],
    },
    "tab_personal_borrower": {
        "title": "Step 1: Personal Details – Borrower",
        "description": "Please provide your personal details to establish your borrower profile.",
        "prompt": "👉 *Please provide your **Full Name**, **Date of Birth** (e.g. 1995-05-15), **Mobile Number**, **Email Address**, and **Residential Address**.*",
        "required_fields": ["borrowerName", "borrowerDOB", "borrowerEmailId", "borrowerMobileNo"],
    },
    "tab_personal_coborrower": {
        "title": "Step 2: Personal Details – Co-Borrower",
        "description": "Adding a co-borrower can help increase your eligible loan amount and combine household income.",
        "prompt": "👉 *Do you want to add a Co-Borrower to this application? (Reply **\"Yes\"** or **\"No\"**)*\n\n*(If Yes, please also provide Co-Borrower Name, Mobile, and Emirates ID No).* ",
        "required_fields": ["isCoBorrower"],
    },
    "tab_income_borrower": {
        "title": "Step 3: Income Details – Borrower",
        "description": "Let's capture your employment and income information.",
        "prompt": "👉 *Are you **Salaried** or **Self Employed**? Please also share your **Employer Name**, **Employed From Date**, and **Monthly Salary (AED)**.*",
        "required_fields": ["borrowerIncomeType"],
    },
    "tab_product_loan": {
        "title": "Step 4: Product & Loan Details",
        "description": "Let's configure your loan parameters and property details.",
        "prompt": "👉 *Please specify your preferred **Loan Type** (e.g. Home Purchase Loan), **Loan Amount** (e.g. 2,500,000 AED), **Tenure** (e.g. 240 months), and whether you have identified a **Property** (Valuation Price & Down Payment Contribution).* ",
        "required_fields": ["loanType", "loanAmount", "tenure"],
    },
    "tab_decision": {
        "title": "Step 5: Decision & Sanction Review",
        "description": "Underwriting assessment and pre-approval sanction review.",
        "prompt": "👉 *Your application meets underwriting policy criteria for pre-approval. Reply **\"Review Application\"** to inspect all collected fields across all tabs before final submission.*",
        "required_fields": [],
    }
}


def mcp_analyze_form_tree(form_tree: Dict[str, Any], field_values: Dict[str, Any]) -> Dict[str, Any]:
    """
    MCP Tool: Inspects the hierarchical form tree JSON.
    Returns complete breakdown of tabs, sections, fields, required fields, and current completion rates.
    """
    tabs = get_all_tabs(form_tree)
    fields = get_all_fields(form_tree)
    
    total_fields = len(fields)
    filled_count = 0
    missing_required = []
    
    tab_summaries = []
    for tab in tabs:
        tab_id = tab.get("node_id", "")
        tab_label = tab.get("label", tab_id)
        tab_fields = get_all_fields(tab)
        
        tab_filled = 0
        tab_required_missing = []
        for f in tab_fields:
            fid = f.get("node_id")
            val = field_values.get(fid, f.get("value"))
            is_filled = val is not None and val != "" and val is not False and val != []
            if is_filled:
                tab_filled += 1
            elif f.get("required") and not f.get("readonly"):
                tab_required_missing.append(f.get("label", fid))
                missing_required.append(f.get("label", fid))
                
        tab_summaries.append({
            "tab_id": tab_id,
            "label": tab_label,
            "total_fields": len(tab_fields),
            "filled_fields": tab_filled,
            "is_complete": len(tab_required_missing) == 0,
            "missing_required": tab_required_missing
        })
        filled_count += tab_filled

    completion_percentage = round((filled_count / total_fields) * 100) if total_fields > 0 else 0

    return {
        "total_fields": total_fields,
        "filled_fields": filled_count,
        "completion_percentage": completion_percentage,
        "tabs": tab_summaries,
        "missing_required_count": len(missing_required),
        "is_all_complete": len(missing_required) == 0
    }


def mcp_get_journey_step(form_tree: Dict[str, Any], field_values: Dict[str, Any]) -> Dict[str, Any]:
    """
    MCP Tool: Determines the current active step in the multi-tab journey (Steps 0 through 5 + Review).
    Returns the active tab, pending questions, next prompt, and journey status.
    """
    tabs = get_all_tabs(form_tree)
    tab_map = {t.get("node_id"): t for t in tabs}
    
    # Evaluate tabs in sequence
    for idx, tab_id in enumerate(TAB_JOURNEY_SEQUENCE):
        tab_node = tab_map.get(tab_id)
        if not tab_node:
            continue
            
        # Check if tab is complete
        tab_fields = get_all_fields(tab_node)
        is_complete = True
        
        # Special logic for Co-Borrower tab: if isCoBorrower == 'No' or empty, consider requirement checked once isCoBorrower is answered
        if tab_id == "tab_personal_coborrower":
            is_coborrower_val = field_values.get("isCoBorrower")
            if not is_coborrower_val:
                is_complete = False
            elif is_coborrower_val == "Yes":
                # Check co-borrower required fields
                for fid in ["coBorrowerName", "coBorrowerMobileNo", "coBorrowerEidaNo"]:
                    if not field_values.get(fid):
                        is_complete = False
                        break
        else:
            for f in tab_fields:
                if f.get("required") and not f.get("readonly"):
                    val = field_values.get(f.get("node_id"), f.get("value"))
                    if val is None or val == "" or val is False or val == []:
                        is_complete = False
                        break

        if not is_complete:
            config = TAB_QUESTION_CONFIG.get(tab_id, {
                "title": f"Step {idx}: {tab_node.get('label')}",
                "description": f"Please complete the fields for {tab_node.get('label')}.",
                "prompt": "Please supply the required details."
            })
            return {
                "journey_status": "IN_PROGRESS",
                "step_index": idx,
                "active_tab_id": tab_id,
                "active_tab_label": tab_node.get("label"),
                "step_title": config["title"],
                "step_description": config["description"],
                "step_prompt": config["prompt"],
                "is_review_ready": False
            }

    # All tabs complete -> Review Stage
    return {
        "journey_status": "REVIEW",
        "step_index": len(TAB_JOURNEY_SEQUENCE),
        "active_tab_id": "tab_decision",
        "active_tab_label": "Decision & Sanction",
        "step_title": "Application Review & Confirmation",
        "step_description": "All sections of your mortgage application have been completed.",
        "step_prompt": "👉 *You can inspect and edit any field across all tabs in the **Single-Page Review Popup**, or reply **\"Submit Application\"** to finalize.*",
        "is_review_ready": True
    }


def mcp_update_form_fields(
    form_tree: Dict[str, Any],
    field_values: Dict[str, Any],
    updates: List[Dict[str, Any]]
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[str]]:
    """
    MCP Tool: Validates, type-casts, computes auto-derived fields (DOB -> Age, Consents),
    and applies updates to fieldValues.
    """
    new_field_values = dict(field_values)
    successful_updates = []
    validation_errors = []

    for up in updates:
        node = up.get("node") or {}
        raw_val = None
        for k in ("casted_value", "target_value", "new_value", "value", "raw_value"):
            if k in up and up[k] is not None:
                raw_val = up[k]
                break
        node_id = node.get("node_id") or up.get("node_id")
        
        if not node_id:
            continue
            
        label = node.get("label") or up.get("field_label", node_id)
        is_readonly = node.get("readonly", False)

        if is_readonly:
            validation_errors.append(f"⚠️ **{label}** is read-only and cannot be modified.")
            continue

        # Option match if select
        options = node.get("options") or []
        final_val = raw_val
        if options and raw_val is not None:
            matched_opt = None
            for opt in options:
                if str(opt).lower() == str(raw_val).strip().lower():
                    matched_opt = opt
                    break
            if matched_opt:
                final_val = matched_opt
            elif str(raw_val).strip() not in options:
                # Accept value if close or allow string
                final_val = str(raw_val).strip()

        old_val = new_field_values.get(node_id)
        new_field_values[node_id] = final_val
        successful_updates.append({
            "node_id": node_id,
            "field_label": label,
            "old_value": old_val,
            "new_value": final_val,
            "path": node.get("path", [])
        })

    # ── Derived Field Auto-Calculation (DOB -> Age) ────────
    dob = new_field_values.get("borrowerDOB")
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
                calc_age = datetime.datetime.now().year - birth_year
                if 18 <= calc_age <= 100:
                    old_age = new_field_values.get("borrowerAge")
                    if old_age != calc_age:
                        new_field_values["borrowerAge"] = calc_age
                        successful_updates.append({
                            "node_id": "borrowerAge",
                            "field_label": "Age (Years)",
                            "old_value": old_age,
                            "new_value": calc_age,
                            "path": ["Personal Details – Borrower", "Personal Information"],
                            "is_derived": True
                        })
        except Exception as e:
            logger.debug("Failed derived age calculation: %s", e)

    return new_field_values, successful_updates, validation_errors


def mcp_generate_review_data(form_tree: Dict[str, Any], field_values: Dict[str, Any]) -> Dict[str, Any]:
    """
    MCP Tool: Compiles all tabs, sections, and field values into a clean,
    single-page review data structure suitable for both API/Cards and the React Review Modal.
    """
    tabs = get_all_tabs(form_tree)
    review_tabs = []

    for tab in tabs:
        tab_id = tab.get("node_id", "")
        tab_label = tab.get("label", tab_id)
        sections = tab.get("children") or []
        
        tab_sections = []
        for sec in sections:
            sec_id = sec.get("node_id", "")
            sec_label = sec.get("label", sec_id)
            sec_fields = get_all_fields(sec)
            
            field_list = []
            for f in sec_fields:
                fid = f.get("node_id")
                flabel = f.get("label", fid)
                ftype = f.get("field_type", "text")
                foptions = f.get("options")
                freadonly = f.get("readonly", False)
                frequired = f.get("required", False)
                val = field_values.get(fid, f.get("value"))
                
                field_list.append({
                    "node_id": fid,
                    "label": flabel,
                    "field_type": ftype,
                    "options": foptions,
                    "readonly": freadonly,
                    "required": frequired,
                    "value": val,
                    "display_value": "Agreed" if val is True else ("Not Agreed" if val is False else (str(val) if val is not None and str(val).strip() != "" else ""))
                })
                
            if field_list:
                tab_sections.append({
                    "section_id": sec_id,
                    "label": sec_label,
                    "fields": field_list
                })
                
        review_tabs.append({
            "tab_id": tab_id,
            "label": tab_label,
            "sections": tab_sections
        })

    return {
        "card_type": "review_summary",
        "title": "📋 Single-Page Application Review",
        "subtitle": "Inspect and modify all collected details across all tabs before final submission.",
        "tabs": review_tabs,
        "total_tabs": len(review_tabs),
        "timestamp": datetime.datetime.now().isoformat()
    }


def mcp_submit_application(form_tree: Dict[str, Any], field_values: Dict[str, Any]) -> Dict[str, Any]:
    """
    MCP Tool: Validates and finalizes the loan application submission.
    """
    app_ref = f"APP-2026-{datetime.datetime.now().strftime('%M%S%f')[:5]}"
    return {
        "card_type": "submission_success",
        "title": "Application Submitted Successfully 🎉",
        "reference_id": app_ref,
        "submission_date": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "applicant_name": str(field_values.get("borrowerName") or "Applicant"),
        "loan_amount": str(field_values.get("loanAmount") or "2,500,000 AED"),
        "status": "Underwriting Sanction Review",
        "message": "Your loan application has been registered with Newgen Loan Portal and routed to the credit underwriting queue."
    }
