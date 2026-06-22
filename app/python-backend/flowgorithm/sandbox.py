"""
Sandbox Security Validator

Validates Flowgorithm ASTs for security compliance before execution.
The sandbox allows only whitelisted standard library modules and blocks
dangerous operations (file I/O, network, system calls, etc.).

Validation is performed on the AST structure itself (at load time),
and the interpreter enforces sandbox rules at runtime (at execute time).
"""

from typing import Any

# Allowed Python standard library modules in expressions
ALLOWED_MODULES = frozenset({
    "math",
    "random",
    "string",
    "itertools",
    "functools",
    "collections",
    "statistics",
    "fractions",
    "decimal",
    "json",  # serialization only — no file I/O
})

# Forbidden patterns in expressions (checked at runtime)
FORBIDDEN_NAMES = frozenset({
    "__import__",
    "__builtins__",
    "__loader__",
    "__spec__",
    "compile",
    "eval",
    "exec",
    "open",
    "breakpoint",
    "input",
    "__subclasses__",
    "__bases__",
    "__mro__",
    "__globals__",
    "__code__",
    "__class__",
    "getattr",
    "setattr",
    "delattr",
    "hasattr",
    "globals",
    "locals",
    "vars",
})

# Forbidden attribute prefixes (block access to dunder attributes)
FORBIDDEN_ATTR_PREFIXES = ("__", "_")

# Maximum allowed values to prevent resource exhaustion
MAX_ARRAY_SIZE = 1_000_000
MAX_LOOP_ITERATIONS = 10_000
MAX_RECURSION_DEPTH = 1_000
MAX_STRING_LENGTH = 10_000_000


class SandboxValidator:
    """Validates ASTs and expressions for security compliance."""

    def validate(self, ast: dict[str, Any]) -> list[dict[str, Any]]:
        """Validate a program AST and return a list of warnings/violations.

        An empty list means the AST is safe to execute.

        Args:
            ast: The full Program AST from the frontend.

        Returns:
            A list of warning dicts, each with 'severity' and 'message' keys.
        """
        warnings: list[dict[str, Any]] = []

        functions = ast.get("functions", [])
        if not functions:
            warnings.append({
                "severity": "warning",
                "message": "Program has no functions defined.",
            })
            return warnings

        # Validate each function
        for func in functions:
            func_name = func.get("name", "<unnamed>")
            self._validate_body(func.get("body", []), func_name, warnings)

        return warnings

    def _validate_body(
        self,
        body: list[dict[str, Any]],
        func_name: str,
        warnings: list[dict[str, Any]],
    ):
        """Recursively validate a statement body."""
        for stmt in body:
            kind = stmt.get("kind", "")

            if kind == "declare":
                size_expr = stmt.get("size")
                if size_expr:
                    self._check_expression(size_expr, f"{func_name}:declare.size", warnings)
                init_expr = stmt.get("expression")
                if init_expr:
                    self._check_expression(init_expr, f"{func_name}:declare.init", warnings)

            elif kind == "assign":
                expr = stmt.get("expression", "")
                if expr:
                    self._check_expression(str(expr), f"{func_name}:assign", warnings)

            elif kind == "output":
                expr = stmt.get("expression", "")
                if expr:
                    self._check_expression(str(expr), f"{func_name}:output", warnings)

            elif kind == "call":
                call_expr = stmt.get("expression", "")
                if call_expr:
                    self._check_expression(str(call_expr), f"{func_name}:call", warnings)

            elif kind == "if":
                cond = stmt.get("expression", "")
                if cond:
                    self._check_expression(str(cond), f"{func_name}:if.condition", warnings)
                self._validate_body(stmt.get("thenBranch", []), func_name, warnings)
                self._validate_body(stmt.get("elseBranch", []), func_name, warnings)

            elif kind in ("while", "do"):
                cond = stmt.get("expression", "")
                if cond:
                    self._check_expression(str(cond), f"{func_name}:{kind}.condition", warnings)
                self._validate_body(stmt.get("body", []), func_name, warnings)

            elif kind == "for":
                for expr_key in ("start", "end", "step"):
                    expr = stmt.get(expr_key, "")
                    if expr:
                        self._check_expression(str(expr), f"{func_name}:for.{expr_key}", warnings)
                self._validate_body(stmt.get("body", []), func_name, warnings)

            elif kind == "input":
                pass  # Input statements are safe — they don't contain user expressions

    def _check_expression(
        self,
        expr: str,
        context: str,
        warnings: list[dict[str, Any]],
    ):
        """Check an expression for forbidden patterns."""
        if not expr:
            return

        expr_lower = expr.lower()

        for name in FORBIDDEN_NAMES:
            if name.lower() in expr_lower:
                warnings.append({
                    "severity": "error",
                    "message": f"Forbidden name '{name}' found in expression at {context}",
                })

    @staticmethod
    def is_whitelisted_module(module_name: str) -> bool:
        """Check whether a module import is allowed."""
        return module_name in ALLOWED_MODULES
