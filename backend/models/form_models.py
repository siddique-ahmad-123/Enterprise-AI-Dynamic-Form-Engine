"""
Dynamic Form Pydantic Models & Type Definitions.

Supports arbitrary nesting depth (Form -> Tab -> Section -> Panel -> Group -> Container -> Field)
and rich metadata for AI tree traversal & semantic matching.
"""

from typing import List, Optional, Any, Dict, Union
from enum import Enum
from pydantic import BaseModel, Field


class NodeType(str, Enum):
    FORM = "form"
    TAB = "tab"
    SECTION = "section"
    PANEL = "panel"
    GROUP = "group"
    CONTAINER = "container"
    FIELD = "field"
    ACTION_BUTTON = "action_button"
    UPLOAD = "upload"
    SLIDER = "slider"
    SEGMENT = "segment"


class FieldType(str, Enum):
    TEXT = "text"
    NUMBER = "number"
    EMAIL = "email"
    PHONE = "phone"
    SELECT = "select"
    DATE = "date"
    TEXTAREA = "textarea"
    CHECKBOX = "checkbox"
    SWITCH = "switch"
    RATING = "rating"
    RADIO = "radio"
    FILE = "file"


class FormNode(BaseModel):
    """
    Hierarchical form tree node.
    Supports recursive nesting via `children`.
    """
    node_id: str
    node_type: NodeType
    label: str
    field_type: Optional[FieldType] = None
    readonly: bool = False
    required: bool = False
    options: Optional[List[str]] = None
    placeholder: Optional[str] = None
    description: Optional[str] = None
    condition: Optional[str] = None
    value: Optional[Any] = None
    min: Optional[float] = None
    max: Optional[float] = None
    step: Optional[float] = None
    unit: Optional[str] = None
    children: Optional[List["FormNode"]] = Field(default_factory=list)

    class Config:
        arbitrary_types_allowed = True



FormNode.model_rebuild()


class IntentType(str, Enum):
    UPDATE_FIELD = "UPDATE_FIELD"
    QUERY_FIELD = "QUERY_FIELD"
    CLEAR_FIELD = "CLEAR_FIELD"
    NAVIGATE_TAB = "NAVIGATE_TAB"
    SUMMARIZE_FORM = "SUMMARIZE_FORM"
    FIND_MISSING = "FIND_MISSING"
    EXPLAIN_FIELD = "EXPLAIN_FIELD"
    PLOT_CHART = "PLOT_CHART"
    CONFIRM_CONSENT = "CONFIRM_CONSENT"
    REVIEW_APPLICATION = "REVIEW_APPLICATION"
    SUBMIT_APPLICATION = "SUBMIT_APPLICATION"
    UNKNOWN = "UNKNOWN"


class SingleFieldUpdate(BaseModel):
    target_field_query: str
    target_value: Optional[Any] = None


class IntentAnalysis(BaseModel):
    intent: IntentType = IntentType.UNKNOWN
    target_field_query: Optional[str] = None
    target_tab_query: Optional[str] = None
    target_value: Optional[Any] = None
    chart_type: Optional[str] = None
    updates: List[SingleFieldUpdate] = Field(default_factory=list)
    reasoning: Optional[str] = None




class NodeMatchResult(BaseModel):
    node: Optional[FormNode] = None
    path: List[str] = Field(default_factory=list)
    confidence: float = 0.0
    match_reason: str = ""
    is_readonly: bool = False


class FormAction(BaseModel):
    action_type: str
    node_id: Optional[str] = None
    field_label: Optional[str] = None
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    timestamp: Optional[str] = None
    message: str = ""
