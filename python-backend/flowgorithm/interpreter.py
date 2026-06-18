"""
Flowgorithm Interpreter

Executes a Flowgorithm program AST step by step using the Python runtime.
Provides accurate Python error messages, real standard library support,
and step-through debugging compatible with the frontend's event model.

Architecture:
- The interpreter loads a program AST via `load_program`.
- Each call to `step()` executes ONE flowchart node and returns an event.
- `run()` executes nodes continuously until done/error/input-request.
- Variable state and call frames are tracked for the frontend's variable monitor.
"""

import math
from typing import Any

from flowgorithm.ast_parser import (
    build_function_index,
    get_statement_kind,
    get_statement_node_id,
    get_statement_text,
    validate_ast,
)
from flowgorithm.builtins import get_builtin, has_builtin
from flowgorithm.type_system import (
    TYPE_BOOLEAN,
    TYPE_INTEGER,
    TYPE_REAL,
    TYPE_STRING,
    coerce_value,
    default_value,
    element_type,
    format_output,
    is_array_type,
    normalize_expression,
)


class StopExecution(Exception):
    """Raised to terminate execution (user-initiated stop)."""
    pass


class InputRequired(Exception):
    """Raised when an input statement needs user input (pause point)."""
    pass


class ExecutionError(Exception):
    """Wraps execution errors with source statement context."""

    def __init__(self, message: str, statement: dict[str, Any] | None = None):
        self.statement = statement
        super().__init__(message)


# ── Expression Evaluator ────────────────────────────────────────────────────

def evaluate_expression(
    expr: str,
    variables: dict[str, Any],
    functions: dict[str, Any],
) -> Any:
    """Evaluate a Flowgorithm expression using the Python runtime.

    The expression is first normalized (Flowgorithm syntax → Python syntax),
    then evaluated with `eval()` in a restricted namespace containing only
    the current variables, user-defined functions, and allowed built-ins.

    Args:
        expr: The Flowgorithm expression string (e.g., "x + 1", "arr[0]").
        variables: Current scope variable map (name → value).
        functions: Map of user-defined function names to their callables.

    Returns:
        The evaluated value.

    Raises:
        Various Python exceptions (NameError, TypeError, ValueError, etc.)
        with clear, learner-friendly messages.
    """
    if not expr or not expr.strip():
        raise ValueError("Empty expression")

    # Normalize Flowgorithm syntax to Python
    py_expr = normalize_expression(expr)

    # Build the restricted evaluation namespace
    safe_globals: dict[str, Any] = {
        "__builtins__": {
            "abs": abs,
            "min": min,
            "max": max,
            "round": round,
            "pow": pow,
            "int": int,
            "float": float,
            "str": str,
            "bool": bool,
            "len": len,
            "range": range,
            "list": list,
            "True": True,
            "False": False,
            "None": None,
            "isinstance": isinstance,
        },
        "math": math,
        # Flowgorithm built-in functions (case-insensitive)
        "sqrt": math.sqrt,
        "abs": abs,
        "sin": math.sin,
        "cos": math.cos,
        "tan": math.tan,
        "log": math.log,
        "exp": math.exp,
        "round": round,
        "floor": math.floor,
        "ceil": math.ceil,
        "min": min,
        "max": max,
        "pow": pow,
        "len": len,
    }

    # Add current variables
    safe_globals.update(variables)

    # Add user-defined functions (as callables)
    safe_globals.update(functions)

    # Add built-in functions from our registry with case-insensitive aliases.
    # Flowgorithm is case-insensitive for function names, so we register
    # lowercase, PascalCase, and UPPERCASE variants of every built-in.
    from flowgorithm.builtins import BUILTINS
    for name, fn in BUILTINS.items():
        lo = name.lower()
        pascal = name[0].upper() + name[1:] if name else name
        up = name.upper()
        safe_globals[lo] = fn
        safe_globals[pascal] = fn
        safe_globals[up] = fn

    try:
        result = eval(py_expr, safe_globals, {})
        return result
    except Exception as e:
        # Re-raise with a more descriptive message for learners
        raise type(e)(
            f"Error evaluating '{expr}': {e}"
        ).with_traceback(e.__traceback__) from None


# ── Flowgorithm Interpreter ─────────────────────────────────────────────────

class FlowgorithmInterpreter:
    """Executes a Flowgorithm program AST step by step.

    Usage:
        interp = FlowgorithmInterpreter(ast)
        interp.load()

        # Step-by-step:
        event = interp.step()  # execute one node, return event dict

        # Run to completion:
        events = interp.run()  # execute until done/error/input

        # Handle input:
        event = interp.resolve_input("42")

        # Stop:
        interp.stop()
    """

    MAX_ITERATIONS = 10_000  # Hard limit for loop iterations
    MAX_RECURSION_DEPTH = 1_000  # Hard limit for function recursion
    MAX_ARRAY_SIZE = 1_000_000  # Maximum array element count

    def __init__(self, ast: dict[str, Any]):
        self._ast = ast
        self._functions: dict[str, dict[str, Any]] = {}
        self._user_functions: dict[str, Any] = {}  # name → callable (for eval)
        self._function_enabled: dict[str, bool] = {}  # visualization enabled?

        # Execution state
        self._variables: dict[str, Any] = {}  # current scope variables
        self._variable_types: dict[str, str] = {}  # name → "Integer", "Real[]", etc.
        self._call_frames: list[dict[str, Any]] = []  # stack for function calls
        self._output: list[dict[str, Any]] = []
        self._step_queue: list[dict[str, Any]] = []  # pending events to yield
        self._total_iterations: int = 0
        self._recursion_depth: int = 0
        self._stopped: bool = False
        self._input_pending: bool = False
        self._input_variable: str = ""
        self._loaded: bool = False

        # Generator-like state tracking for step()
        self._initialized: bool = False  # has the step() loop been initialized?
        self._pc_stack: list[dict[str, Any]] = []  # program counter stack
        self._current_function: str = ""
        self._current_body: list[dict[str, Any]] = []
        self._current_index: int = 0

    # ── Public API ──────────────────────────────────────────────────────────

    @property
    def program_functions(self) -> dict[str, dict[str, Any]]:
        return self._functions

    @property
    def entry_point(self) -> str:
        return "Main"

    def load(self) -> None:
        """Load and validate the program AST, preparing for execution."""
        validate_ast(self._ast)
        self._functions = build_function_index(self._ast)

        if "Main" not in self._functions:
            raise ExecutionError("Program must have a 'Main' function")

        # Build user function callables for expression evaluation
        self._build_user_functions()

        # Pre-scan variable declarations in Main to populate types
        main_func = self._functions["Main"]
        self._collect_declarations(main_func.get("body", []))

        self._loaded = True

    def step(self) -> dict[str, Any]:
        """Execute exactly one flowchart node and return the resulting event.

        Returns an event dict with shape:
          - {"event": "statement-enter", "nodeId": ..., "statement": ...}
          - {"event": "statement-leave", "nodeId": ..., "statement": ...}
          - {"event": "output", "text": ..., "nodeId": ...}
          - {"event": "input-request", "variable": ...}
          - {"event": "function-enter", "functionName": ...}
          - {"event": "function-leave", "functionName": ...}
          - {"event": "error", "message": ..., "traceback": ...}
          - {"event": "done"}
        """
        if not self._loaded:
            self.load()

        # If execution hasn't started yet, initialize the PC (once per run)
        if not self._initialized and not self._stopped:
            self._reset_execution()
            main_body = self._functions["Main"].get("body", [])
            self._current_function = "Main"
            self._current_body = main_body
            self._current_index = 0
            self._initialized = True

        # If there are queued events from a previous step, return the next one
        if self._step_queue:
            return self._step_queue.pop(0)

        # If stopped or done
        if self._stopped:
            return {"event": "done"}

        # If waiting for input
        if self._input_pending:
            return {
                "event": "input-request",
                "variable": self._input_variable,
            }

        # Check if we've reached the end of the current body.
        # Loop frames (for/while/do) stay on the stack and re-enter their
        # bodies; branch frames (if/else) pop and continue in the parent.
        while self._current_index >= len(self._current_body) and self._pc_stack:
            top = self._pc_stack[-1]

            # ---- Do-while: check condition after body ----
            if "_doCondition" in top:
                if self._total_iterations >= self.MAX_ITERATIONS:
                    raise ExecutionError(f"Exceeded maximum loop iterations ({self.MAX_ITERATIONS})")
                condition = top["_doCondition"]
                result = evaluate_expression(condition, self._variables, self._user_functions)
                if bool(result):
                    self._total_iterations += 1
                    self._current_body = top["_doBody"]
                    self._current_index = 0
                    break
                else:
                    self._pc_stack.pop()
                    # parent body+index are already saved in ctx; restore them below
                    self._current_body = top["body"]
                    self._current_index = top["index"]
                    self._variables = top.get("variables", self._variables)
                    self._variable_types = top.get("variable_types", self._variable_types)
                    continue

            # ---- For loop: increment, then re-check condition ----
            if "_forVar" in top:
                if self._total_iterations >= self.MAX_ITERATIONS:
                    raise ExecutionError(f"Exceeded maximum loop iterations ({self.MAX_ITERATIONS})")
                var_name = top["_forVar"]
                step = top["_forStep"]
                end = top["_forEnd"]
                self._variables[var_name] = self._variables[var_name] + step
                should_continue = (step > 0 and self._variables[var_name] <= end) or \
                                  (step < 0 and self._variables[var_name] >= end)
                if should_continue:
                    self._total_iterations += 1
                    top["variables"] = dict(self._variables)
                    top["variable_types"] = dict(self._variable_types)
                    stmt = top.get("_forStmt", {})
                    self._current_body = stmt.get("body", [])
                    self._current_index = 0
                    break
                else:
                    self._pc_stack.pop()
                    self._current_body = top["body"]
                    self._current_index = top["index"]
                    continue

            # ---- While loop: re-check condition ----
            if "_whileStmt" in top:
                if self._total_iterations >= self.MAX_ITERATIONS:
                    raise ExecutionError(f"Exceeded maximum loop iterations ({self.MAX_ITERATIONS})")
                stmt = top["_whileStmt"]
                condition = stmt.get("expression", "")
                result = evaluate_expression(condition, self._variables, self._user_functions)
                if bool(result):
                    self._total_iterations += 1
                    top["variables"] = dict(self._variables)
                    top["variable_types"] = dict(self._variable_types)
                    self._current_body = stmt.get("body", [])
                    self._current_index = 0
                    break
                else:
                    self._pc_stack.pop()
                    self._current_body = top["body"]
                    self._current_index = top["index"]
                    continue

            # ---- Function return: pop and restore ----
            if top.get("function") != self._current_function:
                ctx = self._pc_stack.pop()
                self._current_body = ctx["body"]
                self._current_index = ctx["index"]
                self._current_function = ctx.get("function", "")
                if "variables" in ctx:
                    self._variables = ctx["variables"]
                if "variable_types" in ctx:
                    self._variable_types = ctx["variable_types"]
                # Return function-leave event
                return {"event": "function-leave", "functionName": self._current_function}

            # ---- Branch/if completion: pop and continue ----
            ctx = self._pc_stack.pop()
            self._current_body = ctx["body"]
            self._current_index = ctx["index"]
            # continue the while loop (there might be more frames to unwind)

        # After full unwind: check for program end
        if not self._pc_stack and self._current_index >= len(self._current_body):
            self._stopped = True
            return {"event": "done"}

        # Execute the next statement
        stmt = self._current_body[self._current_index]
        self._current_index += 1

        try:
            return self._execute_statement(stmt)
        except StopExecution:
            self._stopped = True
            return {"event": "done"}
        except InputRequired:
            return {
                "event": "input-request",
                "variable": self._input_variable,
            }
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            return {
                "event": "error",
                "message": str(e),
                "traceback": tb,
                "statement": get_statement_text(stmt),
                "nodeId": get_statement_node_id(stmt),
            }

    def run(self) -> list[dict[str, Any]]:
        """Execute until completion or an input-request/error.

        Returns a list of all events generated during execution.
        """
        events: list[dict[str, Any]] = []
        while True:
            event = self.step()
            events.append(event)

            event_type = event.get("event", "")
            if event_type in ("done", "error", "input-request"):
                break

        return events

    def resolve_input(self, value: str) -> dict[str, Any]:
        """Provide the input value after an input-request event.

        Parses the value according to the target variable's type, stores it,
        and continues execution.

        Returns the next event after processing the input.
        """
        if not self._input_pending:
            return {"event": "error", "message": "No input pending"}

        var_name = self._input_variable
        self._input_pending = False
        self._input_variable = ""

        # Handle array element input (e.g., "arr[0]")
        if "[" in var_name and var_name.endswith("]"):
            base_name, index_expr = var_name[:-1].split("[", 1)
            index = evaluate_expression(index_expr, self._variables, self._user_functions)
            index = int(index)
            arr = self._variables.get(base_name, [])
            if not isinstance(arr, list):
                raise ExecutionError(f"'{base_name}' is not an array")
            if index < 0 or index >= len(arr):
                raise ExecutionError(
                    f"Array index {index} out of bounds for '{base_name}' (size {len(arr)})"
                )
            elem_type = element_type(self._variable_types.get(base_name, TYPE_INTEGER))
            arr[index] = coerce_value(self._parse_input(value, elem_type), elem_type)
            self._variables[base_name] = arr
        else:
            target_type = self._variable_types.get(var_name, TYPE_STRING)
            self._variables[var_name] = coerce_value(
                self._parse_input(value, target_type), target_type
            )

        return self.step()

    def stop(self) -> None:
        """Stop execution immediately."""
        self._stopped = True
        self._input_pending = False

    def get_variables(self) -> list[dict[str, Any]]:
        """Get the current scope variables as a list of {name, type, value} dicts."""
        result = []
        for name, value in self._variables.items():
            type_str = self._variable_types.get(name, "auto")
            result.append({
                "name": name,
                "type": type_str,
                "value": self._serialize_value(value),
            })
        return result

    # ── Internal: Execution ──────────────────────────────────────────────────

    def _reset_execution(self) -> None:
        """Reset all execution state for a fresh run."""
        self._variables = {}
        self._variable_types = {}
        self._call_frames = []
        self._output = []
        self._step_queue = []
        self._total_iterations = 0
        self._recursion_depth = 0
        self._stopped = False
        self._input_pending = False
        self._input_variable = ""
        self._initialized = False
        self._pc_stack = []
        self._current_function = ""
        self._current_body = []
        self._current_index = 0

    def _execute_statement(self, stmt: dict[str, Any]) -> dict[str, Any]:
        """Execute a single statement and return the event."""
        kind = get_statement_kind(stmt)
        node_id = get_statement_node_id(stmt)

        if kind in ("declare", "assign", "input", "output", "call"):
            # Leaf statements: enter → execute → leave
            enter_event = {
                "event": "statement-enter",
                "nodeId": node_id,
                "statement": get_statement_text(stmt),
            }

            if kind == "declare":
                self._execute_declare(stmt)
            elif kind == "assign":
                self._execute_assign(stmt)
            elif kind == "input":
                self._execute_input(stmt)
                # Input is special — it pauses and the leave event comes after resolve_input
                # We queue the enter event for now
                self._step_queue.append({
                    "event": "statement-leave",
                    "nodeId": node_id,
                    "statement": get_statement_text(stmt),
                })
                return enter_event
            elif kind == "output":
                self._execute_output(stmt)
            elif kind == "call":
                self._execute_call(stmt)

            leave_event = {
                "event": "statement-leave",
                "nodeId": node_id,
                "statement": get_statement_text(stmt),
            }
            self._step_queue.append(leave_event)
            return enter_event

        elif kind == "if":
            return self._execute_if(stmt)

        elif kind == "while":
            return self._execute_while(stmt)

        elif kind == "for":
            return self._execute_for(stmt)

        elif kind == "do":
            return self._execute_do(stmt)

        elif kind == "more":
            # Placeholder — skip
            return self.step()

        else:
            raise ExecutionError(f"Unknown statement kind: {kind}", stmt)

    # ── Statement Handlers ───────────────────────────────────────────────────

    def _execute_declare(self, stmt: dict[str, Any]) -> None:
        """Handle a declare statement: create variables with types."""
        names_str = stmt.get("name", "")
        var_type = stmt.get("type", TYPE_INTEGER)
        array = stmt.get("array", False)
        size_expr = stmt.get("size", "")
        init_expr = stmt.get("expression", "")

        if array:
            var_type = var_type + "[]"

        # Split comma-separated names
        names = [n.strip() for n in names_str.split(",") if n.strip()]
        if not names:
            raise ExecutionError("Declare statement has no variable name", stmt)

        for name in names:
            self._variable_types[name] = var_type

            if array:
                # Array declaration
                if init_expr and init_expr.strip():
                    # Array literal initializer, e.g., "[1, 2, 3]"
                    if init_expr.strip().startswith("["):
                        values = evaluate_expression(
                            init_expr, self._variables, self._user_functions
                        )
                        if not isinstance(values, list):
                            raise ExecutionError(
                                f"Array initializer for '{name}' must be a list, got {type(values).__name__}",
                                stmt,
                            )
                        elem_type = element_type(var_type)
                        self._variables[name] = [
                            coerce_value(v, elem_type) for v in values
                        ]
                    else:
                        # Size expression
                        size = evaluate_expression(
                            size_expr or init_expr, self._variables, self._user_functions
                        )
                        size = int(size)
                        if size < 0:
                            raise ExecutionError(
                                f"Array size for '{name}' cannot be negative ({size})", stmt
                            )
                        if size > self.MAX_ARRAY_SIZE:
                            raise ExecutionError(
                                f"Array size for '{name}' exceeds maximum ({size} > {self.MAX_ARRAY_SIZE})",
                                stmt,
                            )
                        elem_type = element_type(var_type)
                        self._variables[name] = [default_value(elem_type) for _ in range(size)]
                elif size_expr and size_expr.strip():
                    size = evaluate_expression(
                        size_expr, self._variables, self._user_functions
                    )
                    size = int(size)
                    if size < 0:
                        raise ExecutionError(
                            f"Array size for '{name}' cannot be negative ({size})", stmt
                        )
                    if size > self.MAX_ARRAY_SIZE:
                        raise ExecutionError(
                            f"Array size for '{name}' exceeds maximum ({size} > {self.MAX_ARRAY_SIZE})",
                            stmt,
                        )
                    elem_type = element_type(var_type)
                    self._variables[name] = [default_value(elem_type) for _ in range(size)]
                else:
                    self._variables[name] = []
            else:
                # Scalar declaration
                if init_expr and init_expr.strip():
                    value = evaluate_expression(
                        init_expr, self._variables, self._user_functions
                    )
                    self._variables[name] = coerce_value(value, var_type)
                else:
                    self._variables[name] = default_value(var_type)

    def _execute_assign(self, stmt: dict[str, Any]) -> None:
        """Handle an assign statement."""
        target = stmt.get("variable", "")
        expr_str = stmt.get("expression", "")

        if not target:
            raise ExecutionError("Assign statement has no target variable", stmt)
        if not expr_str or not expr_str.strip():
            raise ExecutionError(f"No expression to assign to '{target}'", stmt)

        # Check if target variable exists
        if "[" in target and target.endswith("]"):
            # Array element assignment: arr[index] = expr
            base_name, index_expr = target[:-1].split("[", 1)
            if base_name not in self._variables:
                raise ExecutionError(
                    f"Variable '{base_name}' is not declared (assign)", stmt
                )
            index = evaluate_expression(index_expr, self._variables, self._user_functions)
            index = int(index)
            arr = self._variables.get(base_name, [])
            if not isinstance(arr, list):
                raise ExecutionError(f"'{base_name}' is not an array", stmt)
            if index < 0 or index >= len(arr):
                raise ExecutionError(
                    f"Array index {index} out of bounds for '{base_name}' (size {len(arr)})",
                    stmt,
                )
            value = evaluate_expression(expr_str, self._variables, self._user_functions)
            elem_type = element_type(self._variable_types.get(base_name, TYPE_INTEGER))
            arr[index] = coerce_value(value, elem_type)
            self._variables[base_name] = arr
        else:
            if target not in self._variables:
                raise ExecutionError(
                    f"Variable '{target}' is not declared (assign)", stmt
                )
            target_type = self._variable_types.get(target, TYPE_STRING)
            value = evaluate_expression(expr_str, self._variables, self._user_functions)
            self._variables[target] = coerce_value(value, target_type)

    def _execute_input(self, stmt: dict[str, Any]) -> None:
        """Handle an input statement — pause for user input."""
        var_name = stmt.get("variable", "")
        if not var_name:
            raise ExecutionError("Input statement has no variable name", stmt)

        # Check that the variable is declared
        base_name = var_name.split("[")[0].strip()
        if base_name not in self._variables and base_name not in self._variable_types:
            raise ExecutionError(
                f"Variable '{base_name}' is not declared (input)", stmt
            )

        self._input_pending = True
        self._input_variable = var_name
        raise InputRequired()

    def _execute_output(self, stmt: dict[str, Any]) -> None:
        """Handle an output statement."""
        expr_str = stmt.get("expression", "")
        if not expr_str or not expr_str.strip():
            return  # Empty output is allowed

        value = evaluate_expression(expr_str, self._variables, self._user_functions)
        text = format_output(value)
        self._output.append({"text": text, "nodeId": get_statement_node_id(stmt)})

        self._step_queue.append({
            "event": "output",
            "text": text,
            "nodeId": get_statement_node_id(stmt),
        })

    def _execute_call(self, stmt: dict[str, Any]) -> None:
        """Handle a call statement."""
        call_expr = stmt.get("expression", "")
        result_var = stmt.get("result", "")

        if not call_expr:
            raise ExecutionError("Call statement has no function call expression", stmt)

        # Parse function name and arguments: FuncName(arg1, arg2, ...)
        paren_idx = call_expr.find("(")
        if paren_idx == -1:
            raise ExecutionError(f"Invalid call syntax: '{call_expr}'", stmt)

        func_name = call_expr[:paren_idx].strip()
        args_str = call_expr[paren_idx:]

        # Check if it's a user-defined function or a built-in
        if func_name in self._functions:
            # Evaluate arguments
            args = self._evaluate_call_args(call_expr, func_name)

            # Emit function-enter event
            self._step_queue.append({
                "event": "function-enter",
                "functionName": func_name,
                "callerNodeId": get_statement_node_id(stmt),
                "callExpression": call_expr,
            })

            # Execute the function and capture return value
            return_value = self._execute_user_function(func_name, args)

            # Store result if there's a result variable
            if result_var:
                func_def = self._functions[func_name]
                return_type = func_def.get("returnType", "None")
                if return_type != "None":
                    self._variables[result_var] = coerce_value(
                        return_value, return_type
                    )
                    self._variable_types[result_var] = return_type

            # Emit function-leave event
            self._step_queue.append({
                "event": "function-leave",
                "functionName": func_name,
            })
        elif has_builtin(func_name):
            # Built-in function — evaluate directly
            args = self._evaluate_call_args(call_expr, func_name)
            builtin_fn = get_builtin(func_name)
            if builtin_fn:
                try:
                    result = builtin_fn(*args)
                except Exception as e:
                    raise ExecutionError(
                        f"Error calling '{func_name}': {e}", stmt
                    )
                if result_var:
                    self._variables[result_var] = result
                    self._variable_types[result_var] = TYPE_REAL if isinstance(result, float) else TYPE_INTEGER if isinstance(result, int) else TYPE_STRING if isinstance(result, str) else TYPE_BOOLEAN
            # else: silently ignore unknown built-ins (compatibility)
        else:
            # Unknown function — try to evaluate as an expression
            try:
                result = evaluate_expression(call_expr, self._variables, self._user_functions)
                if result_var:
                    self._variables[result_var] = result
            except Exception as e:
                raise ExecutionError(
                    f"Unknown function '{func_name}': {e}", stmt
                )

    # ── Control Flow Handlers ────────────────────────────────────────────────

    def _execute_if(self, stmt: dict[str, Any]) -> dict[str, Any]:
        """Handle an if statement."""
        condition = stmt.get("expression", "")
        if not condition:
            raise ExecutionError("If statement has no condition", stmt)

        result = evaluate_expression(condition, self._variables, self._user_functions)
        is_true = bool(result)

        enter_event = {
            "event": "statement-enter",
            "nodeId": get_statement_node_id(stmt),
            "statement": get_statement_text(stmt),
        }

        # Push the continuation (the merge point after if/else) onto the PC stack
        branch = stmt.get("thenBranch") if is_true else stmt.get("elseBranch")
        if branch is None:
            branch = stmt.get("thenBranch") or []

        # Save current position and switch to branch body
        self._pc_stack.append({
            "body": self._current_body,
            "index": self._current_index,
            "function": self._current_function,
        })
        self._current_body = branch
        self._current_index = 0

        leave_event = {
            "event": "statement-leave",
            "nodeId": get_statement_node_id(stmt),
            "statement": get_statement_text(stmt),
        }
        self._step_queue.append(leave_event)
        return enter_event

    def _execute_while(self, stmt: dict[str, Any]) -> dict[str, Any]:
        """Handle a while loop."""
        condition = stmt.get("expression", "")
        if not condition:
            raise ExecutionError("While statement has no condition", stmt)

        if self._total_iterations >= self.MAX_ITERATIONS:
            raise ExecutionError(
                f"Exceeded maximum loop iterations ({self.MAX_ITERATIONS})", stmt
            )

        result = evaluate_expression(condition, self._variables, self._user_functions)

        enter_event = {
            "event": "statement-enter",
            "nodeId": get_statement_node_id(stmt),
            "statement": get_statement_text(stmt),
        }

        if bool(result):
            self._total_iterations += 1
            body = stmt.get("body", [])
            self._pc_stack.append({
                "body": self._current_body,
                "index": self._current_index,
                "function": self._current_function,
                "variables": dict(self._variables),
                "variable_types": dict(self._variable_types),
                "_whileStmt": stmt,
            })
            self._current_body = body
            self._current_index = 0

        leave_event = {
            "event": "statement-leave",
            "nodeId": get_statement_node_id(stmt),
            "statement": get_statement_text(stmt),
        }
        self._step_queue.append(leave_event)
        return enter_event

    def _execute_for(self, stmt: dict[str, Any]) -> dict[str, Any]:
        """Handle a for loop."""
        var_name = stmt.get("variable", "")
        start_expr = stmt.get("start", "0")
        end_expr = stmt.get("end", "0")
        step_expr = stmt.get("step", "1")
        body = stmt.get("body", [])

        if not var_name:
            raise ExecutionError("For statement has no loop variable", stmt)

        if self._total_iterations >= self.MAX_ITERATIONS:
            raise ExecutionError(
                f"Exceeded maximum loop iterations ({self.MAX_ITERATIONS})", stmt
            )

        enter_event = {
            "event": "statement-enter",
            "nodeId": get_statement_node_id(stmt),
            "statement": get_statement_text(stmt),
        }

        # Check if this is the first entry or a re-entry
        is_first = (
            not self._pc_stack
            or self._pc_stack[-1].get("_forVar") != var_name
        )

        if is_first:
            # First entry: initialize loop variable
            start_val = evaluate_expression(start_expr, self._variables, self._user_functions)
            end_val = evaluate_expression(end_expr, self._variables, self._user_functions)
            step_val = evaluate_expression(step_expr, self._variables, self._user_functions)

            var_type = self._variable_types.get(var_name, TYPE_INTEGER)
            self._variables[var_name] = coerce_value(start_val, var_type)
            step_val = coerce_value(step_val, var_type)
            end_val = coerce_value(end_val, var_type)

            should_enter = (step_val > 0 and self._variables[var_name] <= end_val) or \
                           (step_val < 0 and self._variables[var_name] >= end_val)

            if should_enter:
                self._total_iterations += 1
                self._pc_stack.append({
                    "body": self._current_body,
                    "index": self._current_index,
                    "function": self._current_function,
                    "_forVar": var_name,
                    "_forStep": step_val,
                    "_forEnd": end_val,
                    "_forStmt": stmt,
                })
                self._current_body = body
                self._current_index = 0
            # else: skip the body (fall through — leave event queued below)

        leave_event = {
            "event": "statement-leave",
            "nodeId": get_statement_node_id(stmt),
            "statement": get_statement_text(stmt),
        }
        self._step_queue.append(leave_event)
        return enter_event

    def _execute_do(self, stmt: dict[str, Any]) -> dict[str, Any]:
        """Handle a do-while loop (execute body first, then check condition)."""
        condition = stmt.get("expression", "")
        body = stmt.get("body", [])

        if self._total_iterations >= self.MAX_ITERATIONS:
            raise ExecutionError(
                f"Exceeded maximum loop iterations ({self.MAX_ITERATIONS})", stmt
            )

        enter_event = {
            "event": "statement-enter",
            "nodeId": get_statement_node_id(stmt),
            "statement": get_statement_text(stmt),
        }

        self._total_iterations += 1
        self._pc_stack.append({
            "body": self._current_body,
            "index": self._current_index,
            "function": self._current_function,
            "variables": dict(self._variables),
            "variable_types": dict(self._variable_types),
            "_doCondition": condition,
            "_doBody": body,
        })
        self._current_body = body
        self._current_index = 0

        leave_event = {
            "event": "statement-leave",
            "nodeId": get_statement_node_id(stmt),
            "statement": get_statement_text(stmt),
        }
        self._step_queue.append(leave_event)
        return enter_event

    # ── Function Execution ───────────────────────────────────────────────────

    def _execute_user_function(self, func_name: str, args: list[Any]) -> Any:
        """Execute a user-defined function with the given arguments.

        Creates a new scope, binds parameters, executes the function body,
        and returns the value of the return variable.
        """
        if self._recursion_depth >= self.MAX_RECURSION_DEPTH:
            raise ExecutionError(
                f"Exceeded maximum recursion depth ({self.MAX_RECURSION_DEPTH})"
            )

        func_def = self._functions[func_name]
        params = func_def.get("parameters", [])
        return_type = func_def.get("returnType", "None")
        return_var = func_def.get("returnVariable", "")
        body = func_def.get("body", [])

        # Save current scope
        self._pc_stack.append({
            "body": self._current_body,
            "index": self._current_index,
            "function": self._current_function,
            "variables": self._variables,
            "variable_types": self._variable_types,
        })

        # Create new scope
        self._variables = {}
        self._variable_types = {}
        self._recursion_depth += 1

        # Bind parameters with type coercion
        for i, param in enumerate(params):
            pname = param.get("name", "")
            ptype = param.get("type", TYPE_INTEGER)
            if param.get("array", False):
                ptype = ptype + "[]"
            self._variable_types[pname] = ptype
            if i < len(args):
                self._variables[pname] = coerce_value(args[i], ptype)
            else:
                self._variables[pname] = default_value(ptype)

        # Execute function body
        self._current_function = func_name
        self._current_body = body
        self._current_index = 0

        # Run the function body synchronously
        while self._current_index < len(self._current_body):
            stmt = self._current_body[self._current_index]
            self._current_index += 1

            kind = get_statement_kind(stmt)
            try:
                if kind == "declare":
                    self._execute_declare(stmt)
                elif kind == "assign":
                    self._execute_assign(stmt)
                elif kind == "output":
                    self._execute_output(stmt)
                elif kind == "call":
                    self._execute_call(stmt)
                elif kind == "if":
                    self._execute_if(stmt)
                    # Continue executing in the new body
                    continue
                elif kind == "while":
                    self._execute_while(stmt)
                    continue
                elif kind == "for":
                    self._execute_for(stmt)
                    continue
                elif kind == "do":
                    self._execute_do(stmt)
                    continue
                elif kind == "more":
                    pass
            except InputRequired:
                raise ExecutionError(
                    "Input is not supported inside function expressions. "
                    "Move the input statement outside of function calls."
                )

            # Process queued output events from this statement (sync execution)
            while self._step_queue:
                evt = self._step_queue.pop(0)
                if evt.get("event") == "output":
                    self._output.append({
                        "text": evt.get("text", ""),
                        "nodeId": evt.get("nodeId"),
                    })

            # PC unwind for sync function execution
            while self._current_index >= len(self._current_body) and self._pc_stack:
                top = self._pc_stack[-1]

                # Do-while re-check
                if "_doCondition" in top:
                    if self._total_iterations >= self.MAX_ITERATIONS:
                        raise ExecutionError(f"Exceeded maximum loop iterations ({self.MAX_ITERATIONS})")
                    condition = top["_doCondition"]
                    result = evaluate_expression(condition, self._variables, self._user_functions)
                    if bool(result):
                        self._total_iterations += 1
                        self._current_body = top["_doBody"]
                        self._current_index = 0
                        break
                    else:
                        self._pc_stack.pop()
                        self._current_body = top["body"]
                        self._current_index = top["index"]
                        continue

                # For loop re-check
                if "_forVar" in top:
                    if self._total_iterations >= self.MAX_ITERATIONS:
                        raise ExecutionError(f"Exceeded maximum loop iterations ({self.MAX_ITERATIONS})")
                    var_name = top["_forVar"]
                    step = top["_forStep"]
                    end = top["_forEnd"]
                    self._variables[var_name] = self._variables[var_name] + step
                    should_continue = (step > 0 and self._variables[var_name] <= end) or \
                                      (step < 0 and self._variables[var_name] >= end)
                    if should_continue:
                        self._total_iterations += 1
                        top["variables"] = dict(self._variables)
                        top["variable_types"] = dict(self._variable_types)
                        stmt = top.get("_forStmt", {})
                        self._current_body = stmt.get("body", [])
                        self._current_index = 0
                        break
                    else:
                        self._pc_stack.pop()
                        self._current_body = top["body"]
                        self._current_index = top["index"]
                        continue

                # While loop re-check
                if "_whileStmt" in top:
                    if self._total_iterations >= self.MAX_ITERATIONS:
                        raise ExecutionError(f"Exceeded maximum loop iterations ({self.MAX_ITERATIONS})")
                    stmt = top["_whileStmt"]
                    condition = stmt.get("expression", "")
                    result = evaluate_expression(condition, self._variables, self._user_functions)
                    if bool(result):
                        self._total_iterations += 1
                        top["variables"] = dict(self._variables)
                        top["variable_types"] = dict(self._variable_types)
                        self._current_body = stmt.get("body", [])
                        self._current_index = 0
                        break
                    else:
                        self._pc_stack.pop()
                        self._current_body = top["body"]
                        self._current_index = top["index"]
                        continue

                # Check if returning from nested function (shouldn't happen here)
                if top.get("function") != self._current_function:
                    break

                # Branch completion
                ctx = self._pc_stack.pop()
                self._current_body = ctx["body"]
                self._current_index = ctx["index"]

        # Capture return value
        return_value = None
        if return_var and return_var in self._variables:
            return_value = self._variables[return_var]

        # Restore caller scope
        if self._pc_stack:
            ctx = self._pc_stack.pop()
            self._variables = ctx.get("variables", {})
            self._variable_types = ctx.get("variable_types", {})
            self._current_body = ctx["body"]
            self._current_index = ctx["index"]
            self._current_function = ctx.get("function", "")

        self._recursion_depth -= 1
        return return_value

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _build_user_functions(self) -> None:
        """Build callable wrappers for user-defined functions (used in expressions)."""
        # User functions in expressions are handled via resolveExpression in the JS
        # interpreter. In the Python backend, we handle them differently:
        # the _execute_call method detects user functions and executes them with
        # proper scope management. For expressions like "fib(n-1) + fib(n-2)",
        # we pre-resolve function calls before evaluating the expression.
        pass

    def _collect_declarations(self, body: list[dict[str, Any]]) -> None:
        """Recursively collect all variable declarations in a function body."""
        for stmt in body:
            kind = get_statement_kind(stmt)
            if kind == "declare":
                names_str = stmt.get("name", "")
                var_type = stmt.get("type", TYPE_INTEGER)
                array = stmt.get("array", False)
                if array:
                    var_type = var_type + "[]"
                names = [n.strip() for n in names_str.split(",") if n.strip()]
                for name in names:
                    self._variable_types[name] = var_type
            elif kind in ("if",):
                self._collect_declarations(stmt.get("thenBranch", []))
                self._collect_declarations(stmt.get("elseBranch", []))
            elif kind in ("while", "for", "do"):
                self._collect_declarations(stmt.get("body", []))

    def _evaluate_call_args(self, call_expr: str, func_name: str) -> list[Any]:
        """Parse and evaluate the arguments of a function call.

        Handles nested function calls like fib(n-1) by resolving them recursively.
        """
        # Extract the argument string between parentheses
        paren_idx = call_expr.find("(")
        if paren_idx == -1:
            return []

        # Find the matching closing parenthesis
        args_str = call_expr[paren_idx + 1:]
        depth = 1
        close_idx = -1
        for i, ch in enumerate(args_str):
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0:
                    close_idx = i
                    break

        if close_idx == -1:
            return []

        args_str = args_str[:close_idx].strip()
        if not args_str:
            return []

        # Split arguments by comma, respecting parentheses nesting
        arg_exprs = []
        current = ""
        depth = 0
        for ch in args_str:
            if ch == '(':
                depth += 1
                current += ch
            elif ch == ')':
                depth -= 1
                current += ch
            elif ch == ',' and depth == 0:
                arg_exprs.append(current.strip())
                current = ""
            else:
                current += ch
        if current.strip():
            arg_exprs.append(current.strip())

        # Evaluate each argument
        args = []
        for arg_expr in arg_exprs:
            # Resolve nested function calls first
            resolved = self._resolve_expr_calls(arg_expr)
            value = evaluate_expression(resolved, self._variables, self._user_functions)
            args.append(value)

        return args

    def _resolve_expr_calls(self, expr: str) -> str:
        """Resolve user-defined function calls inside an expression.

        E.g., "fib(n-1) + fib(n-2)" → "1 + 1" (after resolving fib calls).

        This handles nested calls like "fib(fib(2))" as well.
        """
        import re

        # Find user function calls in the expression
        for func_name in self._functions:
            if func_name == "Main":
                continue
            # Match func_name(args) where args may contain nested parens
            pattern = re.escape(func_name) + r'\('
            while pattern in expr:
                idx = expr.find(func_name + "(")
                # Find the matching closing paren
                paren_start = idx + len(func_name)
                depth = 1
                close_idx = -1
                for i in range(paren_start + 1, len(expr)):
                    if expr[i] == '(':
                        depth += 1
                    elif expr[i] == ')':
                        depth -= 1
                        if depth == 0:
                            close_idx = i
                            break
                if close_idx == -1:
                    break

                # Extract the full call
                full_call = expr[idx:close_idx + 1]
                args_str = expr[paren_start + 1:close_idx]

                # Recursively resolve nested calls in arguments
                resolved_args_str = self._resolve_expr_calls(args_str)

                # Evaluate arguments
                arg_exprs = [a.strip() for a in resolved_args_str.split(",")] if resolved_args_str.strip() else []
                args = []
                for ae in arg_exprs:
                    if ae:
                        val = evaluate_expression(ae, self._variables, self._user_functions)
                        args.append(val)

                # Execute the function
                func_def = self._functions[func_name]
                params = func_def.get("parameters", [])
                return_var = func_def.get("returnVariable", "")

                # Save current state
                saved_vars = dict(self._variables)
                saved_types = dict(self._variable_types)

                # Create function scope
                self._variables = {}
                self._variable_types = {}
                for i, param in enumerate(params):
                    pname = param.get("name", "")
                    ptype = param.get("type", TYPE_INTEGER)
                    if param.get("array"):
                        ptype += "[]"
                    self._variable_types[pname] = ptype
                    if i < len(args):
                        self._variables[pname] = coerce_value(args[i], ptype)
                    else:
                        self._variables[pname] = default_value(ptype)

                # Execute function body
                body = func_def.get("body", [])
                for stmt in body:
                    kind = get_statement_kind(stmt)
                    if kind == "declare":
                        self._execute_declare(stmt)
                    elif kind == "assign":
                        self._execute_assign(stmt)
                    elif kind == "call":
                        self._execute_call(stmt)
                    elif kind == "if":
                        self._execute_if(stmt)
                    elif kind == "while":
                        self._execute_while(stmt)
                    elif kind == "for":
                        self._execute_for(stmt)
                    elif kind == "do":
                        self._execute_do(stmt)
                    elif kind == "more":
                        pass

                # Get return value
                result = None
                if return_var and return_var in self._variables:
                    result = self._variables[return_var]

                # Restore state
                self._variables = saved_vars
                self._variable_types = saved_types

                # Replace the call with its literal value
                if isinstance(result, str):
                    replacement = f'"{result}"'
                elif result is True:
                    replacement = 'True'
                elif result is False:
                    replacement = 'False'
                elif result is None:
                    replacement = 'None'
                else:
                    replacement = str(result)

                expr = expr[:idx] + replacement + expr[close_idx + 1:]

        return expr

    def _parse_input(self, value: str, target_type: str) -> Any:
        """Parse a user-provided input string according to the target type."""
        base_type = element_type(target_type)

        if base_type == TYPE_INTEGER:
            try:
                return int(float(value))
            except (ValueError, TypeError):
                raise ValueError(f"Cannot convert '{value}' to Integer")

        elif base_type == TYPE_REAL:
            try:
                return float(value)
            except (ValueError, TypeError):
                raise ValueError(f"Cannot convert '{value}' to Real")

        elif base_type == TYPE_BOOLEAN:
            v = value.strip().lower()
            if v in ("true", "真", "1", "yes"):
                return True
            if v in ("false", "假", "0", "no"):
                return False
            raise ValueError(f"Cannot convert '{value}' to Boolean")

        # String — return as-is
        return value

    def _serialize_value(self, value: Any) -> Any:
        """Serialize a value for JSON transmission to the frontend."""
        if isinstance(value, list):
            return [self._serialize_value(v) for v in value]
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value
        if value is None:
            return None
        return str(value)
