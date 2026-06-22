"""
Flowgorithm Built-in Functions

Implements the standard Flowgorithm built-in function library, which
the current JavaScript interpreter silently ignores.

Functions are registered in BUILTINS dict and made available to the
expression evaluator in the sandboxed execution environment.
"""

import math
import random as _random
from typing import Any, Callable


def _flow_random(n: int) -> int:
    """Flowgorithm Random(n): returns a random integer in [0, n-1]."""
    n = int(n)
    if n <= 0:
        raise ValueError(f"Random() argument must be positive, got {n}")
    return _random.randint(0, n - 1)


def _flow_size(arr: list) -> int:
    """Flowgorithm Size(arr): returns the number of elements in an array."""
    if not isinstance(arr, list):
        raise TypeError(f"Size() argument must be an array, got {type(arr).__name__}")
    return len(arr)


def _flow_len(s: str) -> int:
    """Flowgorithm Len(s): returns the length of a string."""
    return len(str(s))


def _flow_char(s: str, index: int) -> str:
    """Flowgorithm Char(s, i): returns the character at index i (0-based)."""
    s = str(s)
    index = int(index)
    if index < 0 or index >= len(s):
        raise IndexError(f"Char index {index} out of range for string of length {len(s)}")
    return s[index]


def _flow_to_string(value: Any) -> str:
    """Flowgorithm ToString(v): converts a value to its string representation."""
    return str(value)


def _flow_to_integer(value: Any) -> int:
    """Flowgorithm ToInteger(v): converts a value to an integer."""
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, str):
        try:
            return int(float(value))
        except ValueError:
            raise ValueError(f"Cannot convert '{value}' to Integer")
    return int(value)


def _flow_to_real(value: Any) -> float:
    """Flowgorithm ToReal(v): converts a value to a real number."""
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            raise ValueError(f"Cannot convert '{value}' to Real")
    return float(value)


def _flow_round(value: float, decimals: int = 0) -> float:
    """Flowgorithm Round(v, d): rounds to d decimal places."""
    return round(float(value), int(decimals))


# Map of function name → (callable, arg_count_or_none)
# arg_count = None means variadic or determined at call time
BUILTINS: dict[str, Callable] = {
    # Math functions
    "sqrt": math.sqrt,
    "abs": abs,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "arcsin": math.asin,
    "arccos": math.acos,
    "arctan": math.atan,
    "log": math.log,
    "log10": math.log10,
    "exp": math.exp,
    "pow": pow,
    "round": _flow_round,
    "floor": math.floor,
    "ceil": math.ceil,
    "trunc": math.trunc,
    "sign": lambda x: (1 if x > 0 else (-1 if x < 0 else 0)),
    "min": min,
    "max": max,
    # Random
    "random": _flow_random,
    # String functions
    "len": _flow_len,
    "char": _flow_char,
    "tostring": _flow_to_string,
    "size": _flow_size,
    # Type conversion
    "tointeger": _flow_to_integer,
    "toreal": _flow_to_real,
    # Additional Flowgorithm built-ins (aliases for case-insensitive matching)
    "sqrt": math.sqrt,
    "abs": abs,
}

# Lowercase alias map for case-insensitive lookup
BUILTINS_LOWER: dict[str, Callable] = {k.lower(): v for k, v in BUILTINS.items()}


def get_builtin(name: str) -> Callable | None:
    """Look up a built-in function by name (case-insensitive)."""
    return BUILTINS_LOWER.get(name.lower())


def has_builtin(name: str) -> bool:
    """Check if a built-in function exists with the given name."""
    return name.lower() in BUILTINS_LOWER
