"""
Flowgorithm Type System

Defines the four Flowgorithm data types and their coercion rules:
- Integer: whole numbers (floor on assignment)
- Real: floating-point numbers
- String: text
- Boolean: true/false

Array variants (Integer[], Real[], String[], Boolean[]) are supported
via Python lists with bounds checking and type-coerced elements.
"""

from typing import Any

# Flowgorithm type strings (as they appear in the AST)
TYPE_INTEGER = "Integer"
TYPE_REAL = "Real"
TYPE_STRING = "String"
TYPE_BOOLEAN = "Boolean"

# Recognized type strings
VALID_TYPES = {TYPE_INTEGER, TYPE_REAL, TYPE_STRING, TYPE_BOOLEAN}

# Default values for each type
DEFAULT_VALUES: dict[str, Any] = {
    TYPE_INTEGER: 0,
    TYPE_REAL: 0.0,
    TYPE_STRING: "",
    TYPE_BOOLEAN: False,
}

# Chinese boolean literal → Python bool
CHINESE_BOOL_MAP: dict[str, bool] = {
    "真": True,
    "假": False,
    "true": True,
    "false": False,
}


def is_array_type(type_str: str) -> bool:
    """Check if a type string represents an array type (ends with '[]')."""
    return type_str.endswith("[]")


def element_type(type_str: str) -> str:
    """Get the element type for an array type.

    E.g., "Integer[]" → "Integer", "Real[]" → "Real"
    """
    if is_array_type(type_str):
        return type_str[:-2]
    return type_str


def coerce_value(value: Any, target_type: str) -> Any:
    """Coerce a value to the given Flowgorithm type.

    Flowgorithm coercion rules:
    - Integer: floor the number; bool → 0/1; NaN/None → 0
    - Real: preserve float; bool → 0.0/1.0; NaN/None → 0.0
    - String: convert to str; None → ""
    - Boolean: truthiness; "true"/"真" → True; "false"/"假" → False
    """
    base_type = element_type(target_type)

    if base_type == TYPE_INTEGER:
        if isinstance(value, bool):
            return 1 if value else 0
        if isinstance(value, (int, float)):
            if value != value:  # NaN check
                return 0
            return int(value)
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return 0

    elif base_type == TYPE_REAL:
        if isinstance(value, bool):
            return 1.0 if value else 0.0
        if isinstance(value, (int, float)):
            if value != value:  # NaN check
                return 0.0
            return float(value)
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0.0

    elif base_type == TYPE_STRING:
        if value is None:
            return ""
        return str(value)

    elif base_type == TYPE_BOOLEAN:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            lower = value.strip().lower()
            if lower in ("true", "真"):
                return True
            if lower in ("false", "假"):
                return False
        if isinstance(value, (int, float)):
            return value != 0
        return bool(value)

    # Unknown type — return as-is
    return value


def default_value(type_str: str) -> Any:
    """Get the default/zero value for a Flowgorithm type."""
    if is_array_type(type_str):
        return []  # Empty array
    return DEFAULT_VALUES.get(type_str, 0)


def format_output(value: Any) -> str:
    """Format a value for display as program output.

    Booleans are displayed as localized "true"/"false" strings.
    """
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float):
        # Remove trailing .0 for whole numbers
        if value == int(value) and not (value != value):
            return str(int(value))
        return str(value)
    return str(value)


def normalize_expression(expr: str) -> str:
    """Normalize a Flowgorithm expression for Python evaluation.

    Handles Flowgorithm-specific syntax:
    - '='  → '=='  (equality comparison)
    - '<>' → '!=' (not-equal)
    - '&'  → '+'  (string concatenation — context-dependent, handled in interpreter)
    - 'and', 'or', 'not' → lowercase (Flowgorithm is case-insensitive)
    - 'mod' → '%' (modulo)
    - '^'  → '**' (power)
    """
    import re

    expr = expr.strip()

    # Replace Flowgorithm operators with Python equivalents
    # Order matters: '<>' before '<=', '>=' to avoid partial matches

    # Not-equal: <> → !=
    expr = re.sub(r'<>', '!=', expr)

    # Equality: bare '=' → '==' (but not '<=', '>=', '!=', '==')
    # Match '=' that is not preceded by '<', '>', '!' and not followed by '='
    expr = re.sub(r'(?<![<>!])=(?!=)', '==', expr)

    # Logical operators (case-insensitive)
    expr = re.sub(r'\band\b', 'and', expr, flags=re.IGNORECASE)
    expr = re.sub(r'\bor\b', 'or', expr, flags=re.IGNORECASE)
    expr = re.sub(r'\bnot\b', 'not', expr, flags=re.IGNORECASE)

    # Modulo: mod → %
    expr = re.sub(r'\bmod\b', '%', expr, flags=re.IGNORECASE)

    # Power: ^ → **
    expr = expr.replace('^', '**')

    # String concatenation: & → handled at interpreter level
    # (kept as '&' here; the interpreter wraps it appropriately)

    return expr
