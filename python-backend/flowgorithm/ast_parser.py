"""
AST Parser: converts the frontend's Flowgorithm AST (JSON) into an internal
executable representation.

The frontend sends the AST as a JSON object (same structure as the TypeScript
`Program` / `FunctionDef` types). This module validates, normalizes, and indexes
the AST for efficient execution.
"""

from typing import Any


# ── AST Validation ──────────────────────────────────────────────────────────

class ASTValidationError(ValueError):
    """Raised when the AST is malformed or missing required fields."""
    pass


def validate_ast(ast: dict[str, Any]) -> None:
    """Validate the structure of a Program AST.

    Raises ASTValidationError if the AST is invalid.
    """
    if not isinstance(ast, dict):
        raise ASTValidationError("AST must be a JSON object")

    functions = ast.get("functions")
    if not functions or not isinstance(functions, list) or len(functions) == 0:
        raise ASTValidationError("Program must have at least one function")

    has_main = False
    for i, func in enumerate(functions):
        if not isinstance(func, dict):
            raise ASTValidationError(f"Function at index {i} is not an object")
        name = func.get("name")
        if not name:
            raise ASTValidationError(f"Function at index {i} has no name")
        if name == "Main":
            has_main = True
        body = func.get("body")
        if not isinstance(body, list):
            raise ASTValidationError(f"Function '{name}' has no valid body")

    if not has_main:
        raise ASTValidationError("Program must have a 'Main' function")


# ── AST Normalization ───────────────────────────────────────────────────────

def normalize_ast(ast: dict[str, Any]) -> dict[str, Any]:
    """Normalize an AST for execution.

    Ensures all fields have defaults, indexes functions, and attaches
    metadata needed by the interpreter.
    """
    functions = ast.get("functions", [])

    for func in functions:
        func.setdefault("returnType", "None")
        func.setdefault("parameters", [])
        func.setdefault("body", [])

        # Normalize parameters
        for param in func.get("parameters", []):
            param.setdefault("type", "Integer")
            param.setdefault("array", False)

    return ast


# ── Statement Helpers ───────────────────────────────────────────────────────

def get_statement_kind(stmt: dict[str, Any]) -> str:
    """Get the kind of a statement."""
    return stmt.get("kind", "")


def get_statement_node_id(stmt: dict[str, Any]) -> str | None:
    """Get the node ID attached to a statement by FlowchartEngine."""
    return stmt.get("_nodeId")


def get_statement_text(stmt: dict[str, Any]) -> str:
    """Get a human-readable label for a statement (for error messages)."""
    kind = get_statement_kind(stmt)
    if kind == "declare":
        names = stmt.get("name", "?")
        return f"Declare {names}"
    elif kind == "assign":
        target = stmt.get("target", "?")
        return f"Assign {target}"
    elif kind == "input":
        var_name = stmt.get("variable", "?")
        return f"Input {var_name}"
    elif kind == "output":
        expr = stmt.get("expression", "")
        return f"Output {expr[:40]}"
    elif kind == "call":
        call_expr = stmt.get("expression", "")
        return f"Call {call_expr[:40]}"
    elif kind == "if":
        cond = stmt.get("condition", "")
        return f"If {cond[:40]}"
    elif kind == "while":
        cond = stmt.get("condition", "")
        return f"While {cond[:40]}"
    elif kind == "for":
        var_name = stmt.get("variable", "?")
        return f"For {var_name}"
    elif kind == "do":
        cond = stmt.get("condition", "")
        return f"Do {cond[:40]}"
    elif kind == "more":
        return "..."
    return f"<{kind}>"


# ── Function Index ──────────────────────────────────────────────────────────

def build_function_index(ast: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Build a name → function-def lookup map from the AST."""
    return {func["name"]: func for func in ast.get("functions", [])}
