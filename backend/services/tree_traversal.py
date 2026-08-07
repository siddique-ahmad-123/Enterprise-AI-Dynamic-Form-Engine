"""
Tree Traversal & Semantic Matching Utilities for Dynamic Forms.

Provides recursive tree navigation up to unlimited nesting depth,
flattening, Markdown hierarchy rendering, and multi-tier field matching.
"""

import re
import logging
from typing import Dict, List, Any, Optional, Tuple
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)


def normalize_key(text: str) -> str:
    """
    Normalizes a label or node_id for robust matching.

    Examples:
        "Customer Name" -> "customername"
        "Customer_Name" -> "customername"
        "customerName"  -> "customername"
        "client name"   -> "clientname"
    """
    if not text:
        return ""
    # Strip common prefixes like 'tab_', 'sec_', 'field_'
    cleaned = re.sub(r'^(field_|tab_|sec_|group_|panel_|container_)', '', text, flags=re.IGNORECASE)
    # Remove all non-alphanumeric characters and lowercase
    return re.sub(r'[^a-zA-Z0-9]', '', cleaned).lower()


def _ensure_dict(node: Any) -> Dict[str, Any]:
    """Helper to convert Pydantic model or dict to dict."""
    if hasattr(node, "model_dump"):
        return node.model_dump()
    if hasattr(node, "__dict__"):
        return node.__dict__
    if isinstance(node, dict):
        return node
    return {}


def flatten_tree(root: Any, parent_path: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Recursively flattens the tree into a list of node dicts with hierarchy paths.
    Supports unlimited nesting depth.
    """
    if parent_path is None:
        parent_path = []

    node_dict = _ensure_dict(root)
    if not node_dict or "node_id" not in node_dict:
        return []

    node_id = node_dict.get("node_id", "")
    label = node_dict.get("label", node_id)
    current_path = parent_path + [label]

    flattened_item = {
        **node_dict,
        "path": current_path,
        "path_str": " -> ".join(current_path),
    }

    result = [flattened_item]

    children = node_dict.get("children") or []
    for child in children:
        result.extend(flatten_tree(child, current_path))

    return result


def get_all_fields(root: Any) -> List[Dict[str, Any]]:
    """Recursively extracts all field nodes from the tree."""
    all_nodes = flatten_tree(root)
    return [
        node for node in all_nodes
        if node.get("node_type") == "field" or node.get("field_type") is not None
    ]


def get_all_tabs(root: Any) -> List[Dict[str, Any]]:
    """Recursively extracts all tab nodes from the tree."""
    all_nodes = flatten_tree(root)
    return [
        node for node in all_nodes
        if node.get("node_type") == "tab"
    ]


def find_tab_by_query(root: Any, query: str) -> Optional[Dict[str, Any]]:
    """Locates a tab node by matching tab label or node_id."""
    tabs = get_all_tabs(root)
    if not tabs or not query:
        return None

    norm_query = normalize_key(query)

    # 1. Exact node_id match
    for tab in tabs:
        if tab.get("node_id", "").lower() == query.lower():
            return tab

    # 2. Normalized key match
    for tab in tabs:
        if normalize_key(tab.get("label", "")) == norm_query or normalize_key(tab.get("node_id", "")) == norm_query:
            return tab

    # 3. Partial substring match
    for tab in tabs:
        tab_norm = normalize_key(tab.get("label", ""))
        if norm_query in tab_norm or tab_norm in norm_query:
            return tab

    return None


def find_field_by_query(
    root: Any,
    query: str,
    field_values: Optional[Dict[str, Any]] = None
) -> Tuple[Optional[Dict[str, Any]], float, str]:
    """
    Locates the candidate field node matching a natural language query.
    Uses multi-tier matching logic:
    1. Exact node_id
    2. Exact label
    3. Normalized string equivalence (Customer Name == customername)
    4. Substring / Token matching
    5. String similarity scoring

    Returns:
        (matched_node, confidence_score, match_reason)
    """
    fields = get_all_fields(root)
    if not fields or not query:
        return None, 0.0, "No fields or query provided"

    raw_query = query.strip()
    norm_query = normalize_key(raw_query)

    # Tier 1: Exact node_id match
    for field in fields:
        node_id = field.get("node_id", "")
        if node_id.lower() == raw_query.lower():
            return field, 1.0, f"Exact node_id match ('{node_id}')"

    # Tier 2: Exact label match
    for field in fields:
        label = field.get("label", "")
        if label.lower() == raw_query.lower():
            return field, 1.0, f"Exact label match ('{label}')"

    # Tier 3: Normalized key match
    for field in fields:
        label_norm = normalize_key(field.get("label", ""))
        id_norm = normalize_key(field.get("node_id", ""))
        if norm_query == label_norm:
            return field, 0.95, f"Normalized label match ('{field.get('label')}')"
        if norm_query == id_norm:
            return field, 0.95, f"Normalized node_id match ('{field.get('node_id')}')"

    # Tier 4: Substring / Alias matching
    best_candidate = None
    highest_score = 0.0
    reason = ""

    for field in fields:
        label = field.get("label", "")
        label_norm = normalize_key(label)
        node_id = field.get("node_id", "")
        id_norm = normalize_key(node_id)

        # Check if query is contained within label or vice versa
        if norm_query in label_norm or label_norm in norm_query:
            score = 0.85 if len(norm_query) > 3 else 0.70
            if score > highest_score:
                highest_score = score
                best_candidate = field
                reason = f"Substring match in label ('{label}')"

        # Check similarity ratio
        sim_label = SequenceMatcher(None, norm_query, label_norm).ratio()
        sim_id = SequenceMatcher(None, norm_query, id_norm).ratio()
        sim = max(sim_label, sim_id)

        if sim > highest_score and sim >= 0.60:
            highest_score = sim
            best_candidate = field
            reason = f"High fuzzy similarity ({sim:.2f}) with label '{label}'"

    if best_candidate and highest_score >= 0.60:
        return best_candidate, highest_score, reason

    return None, 0.0, f"No field found matching query '{query}'"


def format_tree_as_markdown(root: Any, field_values: Optional[Dict[str, Any]] = None) -> str:
    """
    Renders the hierarchical form tree into a clean Markdown structure
    for LLM prompt context. Includes node types, labels, field types, readonly flags,
    and current values.
    """
    if field_values is None:
        field_values = {}

    lines: List[str] = []

    def _traverse(node: Any, depth: int = 0):
        n = _ensure_dict(node)
        if not n or "node_id" not in n:
            return

        indent = "  " * depth
        node_type = n.get("node_type", "node")
        label = n.get("label", n.get("node_id", ""))
        node_id = n.get("node_id", "")
        readonly = n.get("readonly", False)
        required = n.get("required", False)
        field_type = n.get("field_type", "")
        options = n.get("options")

        val = field_values.get(node_id, n.get("value"))

        flags = []
        if readonly:
            flags.append("READONLY")
        if required:
            flags.append("REQUIRED")

        flag_str = f" [{', '.join(flags)}]" if flags else ""

        if node_type == "field":
            type_str = f" (type: {field_type})" if field_type else ""
            opts_str = f" (options: {', '.join(options)})" if options else ""
            val_str = f" = {repr(val)}" if val is not None else " = (empty)"
            lines.append(f"{indent}- Field: **{label}** (id: `{node_id}`){type_str}{opts_str}{flag_str}{val_str}")
        else:
            lines.append(f"{indent}- [{node_type.upper()}] **{label}** (id: `{node_id}`){flag_str}")

        children = n.get("children") or []
        for child in children:
            _traverse(child, depth + 1)

    _traverse(root)
    return "\n".join(lines)
