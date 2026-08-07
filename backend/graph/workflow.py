"""
LangGraph workflow definition for the AI Dynamic Form Assistant.

Nodes pipeline:
    START
      ↓
    receive_request
      ↓
    understand_intent
      ↓
    traverse_tree
      ↓
    locate_node
      ↓
    validate_action
      ↓
    update_shared_state
      ↓
    generate_response
      ↓
    END
"""

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from state.form_state import FormAgentState
from graph.nodes import (
    receive_request_node,
    understand_intent_node,
    traverse_tree_node,
    locate_node_node,
    validate_action_node,
    update_shared_state_node,
    generate_response_node,
)


def create_form_graph():
    """
    Builds and compiles the dynamic form assistant LangGraph workflow.

    Returns:
        CompiledStateGraph with MemorySaver checkpointer enabled for CopilotKit.
    """
    workflow = StateGraph(FormAgentState)

    # Register nodes
    workflow.add_node("receive_request", receive_request_node)
    workflow.add_node("understand_intent", understand_intent_node)
    workflow.add_node("traverse_tree", traverse_tree_node)
    workflow.add_node("locate_node", locate_node_node)
    workflow.add_node("validate_action", validate_action_node)
    workflow.add_node("update_shared_state", update_shared_state_node)
    workflow.add_node("generate_response", generate_response_node)

    # Define execution pipeline edges
    workflow.set_entry_point("receive_request")
    workflow.add_edge("receive_request", "understand_intent")
    workflow.add_edge("understand_intent", "traverse_tree")
    workflow.add_edge("traverse_tree", "locate_node")
    workflow.add_edge("locate_node", "validate_action")
    workflow.add_edge("validate_action", "update_shared_state")
    workflow.add_edge("update_shared_state", "generate_response")
    workflow.add_edge("generate_response", END)

    # Memory checkpointer required for CopilotKit thread state tracking
    checkpointer = MemorySaver()

    return workflow.compile(checkpointer=checkpointer)


# Singleton graph instance
form_graph = create_form_graph()
