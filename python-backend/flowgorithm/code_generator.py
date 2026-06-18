"""
Code Generator: Flowgorithm AST → Formatted Python Source Code

Converts a Flowgorithm program AST into readable, well-structured Python code.
The generated code preserves the original flowchart semantics while producing
idiomatic Python that learners can read, run, and learn from.

Mapping reference:
- Declare      → typed variable initialization
- Assign       → assignment statement
- Input        → input() with type conversion
- Output       → print()
- Call         → function call
- If/Else      → if/else block
- While        → while loop
- For          → for loop with range()
- Do           → while True + break pattern
"""

from typing import Any

from flowgorithm.ast_parser import get_statement_kind
from flowgorithm.type_system import (
    TYPE_BOOLEAN,
    TYPE_INTEGER,
    TYPE_REAL,
    TYPE_STRING,
    element_type,
    is_array_type,
)


class FlowgorithmCodeGenerator:
    """Generates formatted Python source code from a Flowgorithm AST."""

    def __init__(self, ast: dict[str, Any]):
        self._ast = ast
        self._indent_level = 0
        self._indent_str = "    "  # 4 spaces per PEP 8
        self._output: list[str] = []

    def generate(self) -> str:
        """Generate the complete Python source code.

        Returns a string containing the full, runnable Python program.
        """
        self._output = []
        self._indent_level = 0

        self._emit_line('"""')
        self._emit_line("Generated from Open Flow Algorithm flowchart.")
        self._emit_line("This is executable Python code — run it with: python this_file.py")
        self._emit_line('"""')
        self._emit_line("")

        functions = self._ast.get("functions", [])

        # Separate Main from other functions
        main_func = None
        other_funcs = []
        for func in functions:
            if func.get("name") == "Main":
                main_func = func
            else:
                other_funcs.append(func)

        # Generate other functions first (so Main can call them)
        for func in other_funcs:
            self._generate_function(func)
            self._emit_line("")

        # Generate Main last
        if main_func:
            self._generate_function(main_func, is_main=True)
            self._emit_line("")

        # Add entry point
        self._emit_line('if __name__ == "__main__":')
        self._indent_level += 1
        self._emit_line("main()")
        self._indent_level -= 1

        return "\n".join(self._output)

    # ── Function Generation ──────────────────────────────────────────────────

    def _generate_function(self, func: dict[str, Any], is_main: bool = False) -> None:
        """Generate a complete function definition."""
        func_name = func.get("name", "unknown")
        params = func.get("parameters", [])
        return_type = func.get("returnType", "None")
        body = func.get("body", [])

        # Build parameter list
        param_strs = []
        for param in params:
            pname = param.get("name", "x")
            ptype = param.get("type", TYPE_INTEGER)
            is_array = param.get("array", False)
            type_hint = self._to_python_type(ptype, is_array)
            param_strs.append(f"{pname}: {type_hint}")

        # Return type hint
        return_hint = ""
        if return_type != "None":
            return_hint = f" -> {self._to_python_type(return_type, False)}"

        # Function name (Main → main)
        py_name = "main" if is_main else self._to_snake_case(func_name)

        # Function signature
        self._emit_line(f"def {py_name}({', '.join(param_strs)}){return_hint}:")
        self._indent_level += 1

        # Scan for declarations to initialize locals
        declarations = self._scan_declarations(body)
        for decl in declarations:
            self._generate_declaration(decl)

        if declarations:
            self._emit_line("")

        # Generate body
        self._generate_body(body)

        self._indent_level -= 1

    def _generate_body(self, body: list[dict[str, Any]]) -> None:
        """Generate code for a list of statements."""
        for stmt in body:
            self._generate_statement(stmt)

    def _generate_statement(self, stmt: dict[str, Any]) -> None:
        """Generate code for a single statement."""
        kind = get_statement_kind(stmt)

        if kind == "declare":
            # Already handled in _generate_function for scope initialization
            pass
        elif kind == "assign":
            self._generate_assign(stmt)
        elif kind == "input":
            self._generate_input(stmt)
        elif kind == "output":
            self._generate_output(stmt)
        elif kind == "call":
            self._generate_call(stmt)
        elif kind == "if":
            self._generate_if(stmt)
        elif kind == "while":
            self._generate_while(stmt)
        elif kind == "for":
            self._generate_for(stmt)
        elif kind == "do":
            self._generate_do(stmt)
        elif kind == "more":
            self._emit_line("# ...")
        else:
            self._emit_line(f"# <{kind}>")

    # ── Statement Generators ─────────────────────────────────────────────────

    def _generate_declaration(self, decl: dict[str, Any]) -> None:
        """Generate a variable declaration line."""
        names_str = decl.get("name", "")
        var_type = decl.get("type", TYPE_INTEGER)
        array = decl.get("array", False)
        init_expr = decl.get("expression", "")

        names = [n.strip() for n in names_str.split(",") if n.strip()]
        type_str = self._to_python_type(var_type, array)

        for name in names:
            py_name = self._to_snake_case(name)
            if array:
                if init_expr and init_expr.strip():
                    self._emit_line(f"{py_name}: list = {init_expr}")
                else:
                    self._emit_line(f"{py_name}: list = []  # type: {type_str}")
            else:
                if init_expr and init_expr.strip():
                    py_init = self._normalize_expr(init_expr)
                    self._emit_line(f"{py_name}: {type_str} = {py_init}")
                else:
                    default = self._get_default_value(var_type)
                    self._emit_line(f"{py_name}: {type_str} = {default}")

    def _generate_assign(self, stmt: dict[str, Any]) -> None:
        """Generate an assignment statement."""
        target = stmt.get("variable", "")
        expr = stmt.get("expression", "")
        py_target = self._to_python_target(target)
        py_expr = self._normalize_expr(expr)
        self._emit_line(f"{py_target} = {py_expr}")

    def _generate_input(self, stmt: dict[str, Any]) -> None:
        """Generate an input statement."""
        var_name = stmt.get("variable", "")
        py_var = self._to_python_target(var_name)

        self._emit_line(f"{py_var}_str = input()  # User input")
        self._emit_line(f"# Convert input to the appropriate type")
        self._emit_line(f"{py_var} = {py_var}_str  # TODO: add type conversion")

    def _generate_output(self, stmt: dict[str, Any]) -> None:
        """Generate an output statement."""
        expr = stmt.get("expression", "")
        if not expr or not expr.strip():
            self._emit_line("print()")
            return
        py_expr = self._normalize_expr(expr)
        self._emit_line(f"print({py_expr})")

    def _generate_call(self, stmt: dict[str, Any]) -> None:
        """Generate a function call statement."""
        call_expr = stmt.get("expression", "")
        result_var = stmt.get("result", "")

        py_call = self._normalize_expr(call_expr)
        if result_var:
            py_result = self._to_python_target(result_var)
            self._emit_line(f"{py_result} = {py_call}")
        else:
            self._emit_line(py_call)

    def _generate_if(self, stmt: dict[str, Any]) -> None:
        """Generate an if/else statement."""
        condition = stmt.get("expression", "")
        then_branch = stmt.get("thenBranch", [])
        else_branch = stmt.get("elseBranch", [])

        py_cond = self._normalize_expr(condition)
        self._emit_line(f"if {py_cond}:")
        self._indent_level += 1
        self._generate_body(then_branch)
        self._indent_level -= 1

        if else_branch:
            self._emit_line("else:")
            self._indent_level += 1
            self._generate_body(else_branch)
            self._indent_level -= 1

    def _generate_while(self, stmt: dict[str, Any]) -> None:
        """Generate a while loop."""
        condition = stmt.get("expression", "")
        body = stmt.get("body", [])

        py_cond = self._normalize_expr(condition)
        self._emit_line(f"while {py_cond}:")
        self._indent_level += 1
        self._generate_body(body)
        self._indent_level -= 1

    def _generate_for(self, stmt: dict[str, Any]) -> None:
        """Generate a for loop using range()."""
        var_name = stmt.get("variable", "i")
        start_expr = stmt.get("start", "0")
        end_expr = stmt.get("end", "0")
        step_expr = stmt.get("step", "1")
        body = stmt.get("body", [])

        py_var = self._to_snake_case(var_name)
        py_start = self._normalize_expr(start_expr)
        py_end = self._normalize_expr(end_expr)
        py_step = self._normalize_expr(step_expr)

        # Flowgorithm for is inclusive of end; Python range is exclusive
        # So we adjust: range(start, end + step, step)
        if py_step.strip() == "1":
            self._emit_line(f"for {py_var} in range({py_start}, {py_end} + 1):")
        else:
            self._emit_line(
                f"for {py_var} in range({py_start}, {py_end} + {py_step}, {py_step}):"
            )
        self._indent_level += 1
        self._generate_body(body)
        self._indent_level -= 1

    def _generate_do(self, stmt: dict[str, Any]) -> None:
        """Generate a do-while loop (Python doesn't have one natively).

        Uses the idiomatic 'while True: ... if not condition: break' pattern.
        """
        condition = stmt.get("expression", "")
        body = stmt.get("body", [])

        self._emit_line("while True:  # do-while")
        self._indent_level += 1
        self._generate_body(body)
        py_cond = self._normalize_expr(condition)
        self._emit_line(f"if not ({py_cond}):")
        self._indent_level += 1
        self._emit_line("break")
        self._indent_level -= 1
        self._indent_level -= 1

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _emit_line(self, text: str) -> None:
        """Emit a line of code at the current indentation level."""
        if text:
            self._output.append(self._indent_str * self._indent_level + text)
        else:
            self._output.append("")

    def _to_python_type(self, flow_type: str, is_array: bool) -> str:
        """Convert a Flowgorithm type to a Python type hint."""
        base = element_type(flow_type)
        mapping = {
            TYPE_INTEGER: "int",
            TYPE_REAL: "float",
            TYPE_STRING: "str",
            TYPE_BOOLEAN: "bool",
        }
        py_type = mapping.get(base, "object")
        if is_array or is_array_type(flow_type):
            return f"list[{py_type}]"
        return py_type

    def _get_default_value(self, flow_type: str) -> str:
        """Get the Python default value literal for a Flowgorithm type."""
        base = element_type(flow_type)
        defaults = {
            TYPE_INTEGER: "0",
            TYPE_REAL: "0.0",
            TYPE_STRING: '""',
            TYPE_BOOLEAN: "False",
        }
        return defaults.get(base, "None")

    def _normalize_expr(self, expr: str) -> str:
        """Normalize a Flowgorithm expression to Python.

        Handles: = → ==, <> → !=, and/or/not → lowercase, mod → %, ^ → **
        Also converts camelCase/PascalCase variable names to snake_case.
        """
        from flowgorithm.type_system import normalize_expression
        return normalize_expression(str(expr))

    def _to_python_target(self, target: str) -> str:
        """Convert a Flowgorithm variable/array target to Python.

        - "myVariable" → "my_variable"
        - "arr[0]" → "arr[0]"
        """
        if "[" in target and target.endswith("]"):
            base, idx = target[:-1].split("[", 1)
            return f"{self._to_snake_case(base)}[{idx}]"
        return self._to_snake_case(target)

    @staticmethod
    def _to_snake_case(name: str) -> str:
        """Convert camelCase or PascalCase to snake_case."""
        if not name:
            return name
        # Special cases: single uppercase letter → lowercase
        if len(name) == 1:
            return name.lower()
        # Insert underscore before uppercase letters (not at start)
        result = []
        for i, ch in enumerate(name):
            if ch.isupper() and i > 0:
                # Check if previous char is lowercase or next char is lowercase
                prev_lower = name[i - 1].islower() if i > 0 else False
                next_lower = name[i + 1].islower() if i + 1 < len(name) else False
                if prev_lower or next_lower:
                    result.append("_")
            result.append(ch.lower())
        return "".join(result)

    def _scan_declarations(self, body: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Recursively scan a body for declare statements (for scope initialization)."""
        decls = []
        for stmt in body:
            kind = get_statement_kind(stmt)
            if kind == "declare":
                decls.append(stmt)
            elif kind == "if":
                decls.extend(self._scan_declarations(stmt.get("thenBranch", [])))
                decls.extend(self._scan_declarations(stmt.get("elseBranch", [])))
            elif kind in ("while", "for", "do"):
                decls.extend(self._scan_declarations(stmt.get("body", [])))
        return decls
