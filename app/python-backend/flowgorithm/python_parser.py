"""
Python Source Code -> Flowgorithm AST Parser

Converts Python source code into a Flowgorithm program AST dict using
Python's built-in ast module. Performs reverse normalization of
expressions (== -> =, != -> <>, ** -> ^, % -> mod) and maps
Python type annotations to Flowgorithm types.
"""

import ast
import re
from typing import Any


# ── Expression Helpers ────────────────────────────────────────────────────────

def _to_flow_expr(node: ast.expr | None) -> str:
    """Convert a Python AST expression node to a Flowgorithm expression string."""
    if node is None:
        return ""
    raw = ast.unparse(node)
    return _reverse_normalize(raw)


def _reverse_normalize(expr: str) -> str:
    """Reverse Flowgorithm-normalized Python back to Flowgorithm format.

    This is the inverse of type_system.normalize_expression():
      ** → ^     (power)
      != → <>    (not-equal)
      == → =     (equality — ordered carefully to avoid partial matches)
      %  → mod   (modulo)
    """
    # Power: ** → ^ (do first — unambiguous)
    expr = expr.replace('**', '^')

    # Not-equal: != → <>
    expr = expr.replace('!=', '<>')

    # Equality: == → = (safe — != already converted to <> above)
    expr = expr.replace('==', '=')

    # Modulo: % → mod (word-boundary aware)
    expr = re.sub(r'(?<![a-zA-Z0-9_])%(?![a-zA-Z0-9_])', ' mod ', expr)

    return expr.strip()


# ── Type Mapping ──────────────────────────────────────────────────────────────

_PY_TYPE_TO_FLOW: dict[str, str] = {
    'int': 'Integer',
    'float': 'Real',
    'str': 'String',
    'bool': 'Boolean',
}


def _map_type(type_str: str | None) -> str:
    """Map a Python type annotation string to a Flowgorithm type string."""
    if not type_str:
        return ''
    t = type_str.strip()
    # Handle list types: list[int] → Integer[]
    if t.startswith('list[') and t.endswith(']'):
        inner = t[5:-1].strip()
        inner_mapped = _PY_TYPE_TO_FLOW.get(inner, inner)
        return f'{inner_mapped}[]'
    return _PY_TYPE_TO_FLOW.get(t, t)


# ── Main Entry Point ──────────────────────────────────────────────────────────

def parse_python_code(code: str) -> dict[str, Any]:
    """Parse Python source code into a Flowgorithm Program AST dict.

    Args:
        code: Python source code as a string.

    Returns:
        A dict matching the Flowgorithm Program AST structure
        (see app/src/engine/fprgAst.ts for the TypeScript definition).

    Raises:
        ValueError: If the Python code has invalid syntax.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        raise ValueError(f"Invalid Python syntax: {e}") from e

    functions: list[dict[str, Any]] = []
    main_func: dict[str, Any] | None = None
    top_level_stmts: list[dict[str, Any]] = []

    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            func = _parse_function(node)
            if func['name'].lower() == 'main':
                func['name'] = 'Main'
                main_func = func
            else:
                functions.append(func)
        elif isinstance(node, ast.If) and _is_main_check(node):
            # if __name__ == "__main__": ...
            for sub in node.body:
                if isinstance(sub, ast.Expr) and isinstance(sub.value, ast.Call):
                    called = ast.unparse(sub.value.func)
                    if called.lower() == 'main':
                        continue
                stmt = _parse_statement(sub)
                if stmt:
                    top_level_stmts.append(stmt)
        else:
            stmt = _parse_statement(node)
            if stmt:
                top_level_stmts.append(stmt)

    # Build Main function
    if main_func is None:
        main_func = {
            'kind': 'function',
            'name': 'Main',
            'type': '',
            'variable': '',
            'parameters': [],
            'body': top_level_stmts,
        }
    elif top_level_stmts:
        # Prepend top-level statements before the main function body
        main_func['body'] = top_level_stmts + main_func.get('body', [])

    all_funcs = [main_func] + functions

    return {
        'kind': 'program',
        'attributes': {
            'name': 'Untitled',
            'authors': '',
            'about': '',
            'saved': '',
        },
        'functions': all_funcs,
    }


# ── Helpers ────────────────────────────────────────────────────────────────────

def _is_main_check(node: ast.If) -> bool:
    """Check if an If node is: if __name__ == "__main__": ..."""
    try:
        raw = ast.unparse(node.test)
        return '__name__' in raw and '__main__' in raw
    except Exception:
        return False


def _parse_function(node: ast.FunctionDef) -> dict[str, Any]:
    """Parse a Python function definition into a Flowgorithm FunctionDef."""
    params = []
    for arg in node.args.args:
        param_type = ''
        if arg.annotation:
            param_type = _map_type(ast.unparse(arg.annotation))
        else:
            param_type = 'Integer'  # default for unannotated parameters
        params.append({
            'name': arg.arg,
            'type': param_type,
            'array': False,
        })

    body = _parse_body(node.body)

    return_type = ''
    if node.returns:
        return_type = _map_type(ast.unparse(node.returns))
    elif _has_return_with_value(body):
        return_type = 'Integer'  # default for functions that return values

    # Flowgorithm convention: return variable named after the function
    return_variable = node.name if return_type else ''

    return {
        'kind': 'function',
        'name': node.name,
        'type': return_type,
        'variable': return_variable,
        'parameters': params,
        'body': body,
    }


def _has_return_with_value(body: list[dict[str, Any]]) -> bool:
    """Check if a function body (or sub-branches) contains a return with a value."""
    for stmt in body:
        if stmt.get('kind') == 'return' and stmt.get('expression'):
            return True
        if stmt.get('kind') == 'if':
            if _has_return_with_value(stmt.get('thenBranch', [])):
                return True
            if _has_return_with_value(stmt.get('elseBranch', [])):
                return True
    return False


def _parse_body(stmts: list[ast.stmt]) -> list[dict[str, Any]]:
    """Parse a list of Python statements into Flowgorithm Statement dicts."""
    result: list[dict[str, Any]] = []
    for stmt in stmts:
        parsed = _parse_statement(stmt)
        if parsed:
            result.append(parsed)
    return result


def _parse_statement(node: ast.stmt) -> dict[str, Any] | None:
    """Parse a single Python AST statement into a Flowgorithm Statement dict."""

    # ── Annotated assignment: name: type = value  →  Declare ──
    if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
        var_type = ''
        if node.annotation:
            var_type = _map_type(ast.unparse(node.annotation))
        expr_str = _to_flow_expr(node.value) if node.value else ''
        return {
            'kind': 'declare',
            'name': node.target.id,
            'type': var_type,
            'array': False,
            'size': '',
            'expression': expr_str,
        }

    # ── Assignment ──
    if isinstance(node, ast.Assign):
        if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            value = node.value

            # input() call: var = input("prompt") → Input
            if isinstance(value, ast.Call):
                callee = ast.unparse(value.func)
                if callee == 'input':
                    return {
                        'kind': 'input',
                        'variable': node.targets[0].id,
                    }
                # Regular function call with result: result = func(args)
                call_expr = _to_flow_expr(value)
                return {
                    'kind': 'call',
                    'expression': call_expr,
                    'result': node.targets[0].id,
                }

            # Plain assignment
            expr_str = _to_flow_expr(value)
            return {
                'kind': 'assign',
                'variable': node.targets[0].id,
                'expression': expr_str,
            }

    # ── Expression statement (standalone call) ──
    if isinstance(node, ast.Expr):
        value = node.value
        if isinstance(value, ast.Call):
            callee = ast.unparse(value.func)
            if callee == 'print':
                args = value.args
                expr_str = _to_flow_expr(args[0]) if args else ''
                return {
                    'kind': 'output',
                    'expression': expr_str,
                    'newline': True,
                }
            # Standalone function call (no result)
            call_expr = _to_flow_expr(value)
            return {
                'kind': 'call',
                'expression': call_expr,
                'result': '',
            }

    # ── If / elif / else ──
    if isinstance(node, ast.If):
        cond = _to_flow_expr(node.test)
        then_branch = _parse_body(node.body)
        else_branch = _parse_body(node.orelse)
        return {
            'kind': 'if',
            'expression': cond,
            'thenBranch': then_branch,
            'elseBranch': else_branch,
        }

    # ── While / Do ──
    if isinstance(node, ast.While):
        # while True: → Do (Flowgorithm do-while pattern)
        if isinstance(node.test, ast.Constant) and node.test.value is True:
            body = _parse_body(node.body)
            cond = _extract_do_condition(node.body)
            return {
                'kind': 'do',
                'expression': cond,
                'body': body,
            }
        cond = _to_flow_expr(node.test)
        body = _parse_body(node.body)
        return {
            'kind': 'while',
            'expression': cond,
            'body': body,
        }

    # ── For loop with range() ──
    if isinstance(node, ast.For):
        var_name = node.target.id if isinstance(node.target, ast.Name) else 'i'
        if isinstance(node.iter, ast.Call):
            callee = ast.unparse(node.iter.func)
            if callee == 'range':
                args = node.iter.args
                body = _parse_body(node.body)
                start = '0'
                end = '0'
                step = '1'
                if len(args) == 1:
                    end = _to_flow_expr(args[0])
                elif len(args) == 2:
                    start = _to_flow_expr(args[0])
                    end = _to_flow_expr(args[1])
                elif len(args) >= 3:
                    start = _to_flow_expr(args[0])
                    end = _to_flow_expr(args[1])
                    step = _to_flow_expr(args[2])
                return {
                    'kind': 'for',
                    'variable': var_name,
                    'start': start,
                    'end': end,
                    'step': step,
                    'body': body,
                }
        # Non-range for: skip (no Flowgorithm equivalent)
        return None

    # ── Break ──
    if isinstance(node, ast.Break):
        return {'kind': 'break'}

    # ── Continue ──
    if isinstance(node, ast.Continue):
        return {'kind': 'continue'}

    # ── Return ──
    if isinstance(node, ast.Return):
        expr_str = _to_flow_expr(node.value) if node.value else ''
        return {'kind': 'return', 'expression': expr_str}

    # ── Pass (no-op) ──
    if isinstance(node, ast.Pass):
        return None

    # Unknown — skip
    return None


def _extract_do_condition(body: list[ast.stmt]) -> str:
    """Try to extract the loop condition from a while-True-break pattern.

    Flowgorithm's do-while generates:
        while True:
            ...body...
            if not cond: break

    We extract 'cond' from the innermost if-not-break near the end.
    """
    for stmt in reversed(body):
        if isinstance(stmt, ast.If):
            if len(stmt.body) == 1 and isinstance(stmt.body[0], ast.Break):
                test = stmt.test
                # if not cond: break  → condition is 'cond'
                if isinstance(test, ast.UnaryOp) and isinstance(test.op, ast.Not):
                    return _to_flow_expr(test.operand)
                # if cond: break → need to invert for do-while semantics
                # For now, return as-is; user can adjust
                return _to_flow_expr(test)
    return ''
