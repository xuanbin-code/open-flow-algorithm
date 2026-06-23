"""
Open Flow Algorithm — Python Backend

JSON-RPC 2.0 server communicating over stdin/stdout (newline-delimited JSON).

Usage:
    python -u main.py

The `-u` flag (unbuffered) is REQUIRED for correct operation — it ensures
stdout is line-buffered so each JSON response is flushed immediately.
"""

import json
import sys
import traceback
from typing import Any, Callable

from flowgorithm.interpreter import FlowgorithmInterpreter
from flowgorithm.code_generator import FlowgorithmCodeGenerator
from flowgorithm.sandbox import SandboxValidator
from flowgorithm.python_parser import parse_python_code


# ── JSON-RPC Types ──────────────────────────────────────────────────────────

def make_response(req_id: Any, result: Any = None) -> dict:
    """Build a success JSON-RPC response."""
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def make_error(req_id: Any, code: int, message: str, data: Any = None) -> dict:
    """Build a JSON-RPC error response."""
    resp: dict = {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}
    if data is not None:
        resp["error"]["data"] = data
    return resp


# ── JSON-RPC Handler Registry ───────────────────────────────────────────────

class RpcHandler:
    """Dispatches JSON-RPC method calls to registered handlers."""

    def __init__(self):
        self._methods: dict[str, Callable] = {}
        self._interpreter: FlowgorithmInterpreter | None = None
        self._running = True

    def register(self, name: str):
        """Decorator to register a method handler."""
        def decorator(fn: Callable):
            self._methods[name] = fn
            return fn
        return decorator

    def dispatch(self, request: dict) -> dict:
        """Dispatch a JSON-RPC request and return the response dict."""
        req_id = request.get("id")
        method = request.get("method", "")
        params = request.get("params")

        if not method or method not in self._methods:
            return make_error(req_id, -32601, f"Method not found: {method}")

        try:
            result = self._methods[method](params)
            return make_response(req_id, result)
        except Exception as e:
            tb = traceback.format_exc()
            return make_error(req_id, -32603, str(e), data=tb)


# ── Create handler & register methods ───────────────────────────────────────

handler = RpcHandler()


@handler.register("ping")
def handle_ping(_params: dict | None) -> dict:
    """Health check — returns a simple status object."""
    return {"status": "ok", "version": "0.1.0"}


@handler.register("shutdown")
def handle_shutdown(_params: dict | None) -> dict:
    """Gracefully shut down the Python backend."""
    handler._running = False
    return {"status": "shutting_down"}


@handler.register("load_program")
def handle_load_program(params: dict | None) -> dict:
    """Load a Flowgorithm program AST for execution.

    Expects params.ast (the full Program object from the frontend AST).
    Returns metadata about the loaded program.
    """
    if not params or "ast" not in params:
        raise ValueError("Missing required parameter: ast")

    ast = params["ast"]
    handler._interpreter = FlowgorithmInterpreter(ast)

    functions = list(handler._interpreter.program_functions.keys())
    return {
        "status": "loaded",
        "functions": functions,
        "entryPoint": handler._interpreter.entry_point,
    }


@handler.register("step")
def handle_step(_params: dict | None) -> dict:
    """Execute one flowchart node and return the event.

    Returns an event dict: statement-enter, output, input-request, error, or done.
    """
    if handler._interpreter is None:
        raise RuntimeError("No program loaded. Call load_program first.")

    event = handler._interpreter.step()
    return event


@handler.register("run")
def handle_run(_params: dict | None) -> dict:
    """Run the program to completion and return all events.

    Stops on: done, error, or input-request.
    """
    if handler._interpreter is None:
        raise RuntimeError("No program loaded. Call load_program first.")

    events = handler._interpreter.run()
    return {"events": events}


@handler.register("get_variables")
def handle_get_variables(_params: dict | None) -> dict:
    """Get the current execution state variables."""
    if handler._interpreter is None:
        raise RuntimeError("No program loaded. Call load_program first.")

    return {"variables": handler._interpreter.get_variables()}


@handler.register("set_input")
def handle_set_input(params: dict | None) -> dict:
    """Provide input value after an input-request event.

    Expects params.value (the user-provided input string or number).
    """
    if handler._interpreter is None:
        raise RuntimeError("No program loaded. Call load_program first.")

    if not params or "value" not in params:
        raise ValueError("Missing required parameter: value")

    event = handler._interpreter.resolve_input(params["value"])
    return event


@handler.register("stop")
def handle_stop(_params: dict | None) -> dict:
    """Terminate the current execution."""
    if handler._interpreter is None:
        raise RuntimeError("No program loaded.")

    handler._interpreter.stop()
    return {"status": "stopped"}


@handler.register("export_python")
def handle_export_python(params: dict | None) -> dict:
    """Export the loaded program as formatted Python source code.

    Expects params.ast (the full Program object from the frontend AST).
    Returns the generated Python source code as a string.
    """
    if not params or "ast" not in params:
        raise ValueError("Missing required parameter: ast")

    generator = FlowgorithmCodeGenerator(params["ast"])
    source_code = generator.generate()
    return {"sourceCode": source_code}


@handler.register("validate_ast")
def handle_validate_ast(params: dict | None) -> dict:
    """Validate a loaded AST for security issues.

    Expects params.ast (the full Program object from the frontend AST).
    Returns a list of any security warnings or violations found.
    """
    if not params or "ast" not in params:
        raise ValueError("Missing required parameter: ast")

    validator = SandboxValidator()
    warnings = validator.validate(params["ast"])
    return {"warnings": warnings, "isValid": len(warnings) == 0}


@handler.register("parse_python_code")
def handle_parse_python_code(params: dict | None) -> dict:
    """Parse Python source code into a Flowgorithm program AST.

    Expects params.code (the Python source code string).
    Returns the complete Program AST.
    """
    if not params or "code" not in params:
        raise ValueError("Missing required parameter: code")

    code = params["code"]
    ast_result = parse_python_code(code)
    return {"ast": ast_result}


# ── Main Event Loop ─────────────────────────────────────────────────────────

def main():
    """Run the JSON-RPC stdin/stdout event loop indefinitely."""
    # Signal readiness
    ready_msg = json.dumps({"jsonrpc": "2.0", "id": 0, "result": {"status": "ready", "version": "0.1.0"}})
    sys.stdout.write(ready_msg + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            error_resp = make_error(None, -32700, f"Parse error: {e}")
            sys.stdout.write(json.dumps(error_resp) + "\n")
            sys.stdout.flush()
            continue

        response = handler.dispatch(request)
        sys.stdout.write(json.dumps(response, default=str) + "\n")
        sys.stdout.flush()

        if not handler._running:
            break

    # Clean exit
    sys.exit(0)


if __name__ == "__main__":
    main()
