// ============================================================
// interpreter.ts — AST 解释器（异步 Generator）
//
// 遍历 AST Program，逐条执行语句，yield 运行时事件。
// 外部（index.vue）通过驱动 generator 来控制运行/步进/终止。
// ============================================================

import type { Program, Statement, IfStatement, WhileStatement, ForStatement, FunctionDef } from './fprg-ast'
import { splitDeclareNames } from './fprg-ast'
import { evaluateExpression, coerceValue, defaultValueForType, parseArrayAccess, type EvalFunctions } from './expression-evaluator'
import { i18n } from '../i18n'
const t = i18n.global.t

// ============================================================
// Types
// ============================================================

/** 调用帧：保存调用者作用域，切回时恢复 */
interface CallFrame {
  funcName: string
  variables: Record<string, unknown>
  variableTypes: Record<string, string>
}

export interface RuntimeState {
  /** 变量名 → 当前值 */
  variables: Record<string, unknown>
  /** 变量名 → Flowgorithm 类型名 ("Integer"|"Real"|"String"|"Boolean") */
  variableTypes: Record<string, string>
  /** 调用栈：保存调用者作用域，用于函数返回时恢复 */
  callFrames: CallFrame[]
  /** 输出行缓冲 */
  output: string[]
  /** 当前执行到的语句（null 表示未开始或已完成） */
  currentStatement: Statement | null
  /** 当前执行节点的 ID */
  currentNodeId: string | null
  /** 当前正在执行的函数名（用于子函数执行可视化） */
  currentFunctionName: string
  /** program 引用（用于函数查找） */
  _program?: Program
  /** 同步函数包装器（在 createInterpreter 中构建，供表达式求值时注入） */
  _syncFunctions?: EvalFunctions
  /** 同步递归深度计数器（防止无限递归导致栈溢出） */
  _syncRecursionDepth?: number
}

export type InterpreterEvent =
  | { type: 'statement-enter'; statement: Statement; nodeId: string }
  | { type: 'statement-leave'; statement: Statement; nodeId: string }
  | { type: 'output'; text: string; nodeId?: string }
  | { type: 'input-request'; variable: string }
  | { type: 'function-enter'; functionName: string }
  | { type: 'function-leave'; functionName: string }
  | { type: 'done' }
  | { type: 'error'; message: string; statement?: Statement }

// ============================================================
// Helpers
// ============================================================

const MAX_ITERATIONS = 10000
const MAX_SYNC_RECURSION_DEPTH = 1000

/**
 * 解析调用表达式，提取函数名和参数列表。
 *
 * 例：
 *   "MyFunc(x, y+1)"   → { name: "MyFunc", args: ["x", " y+1"] }
 *   "Random(100)"       → { name: "Random", args: ["100"] }
 *   "Selections()"      → { name: "Selections", args: [] }
 *   "x + 1"             → null (非调用表达式)
 */
function parseCallExpression(expr: string): { name: string; args: string[] } | null {
  const trimmed = expr.trim()
  const match = trimmed.match(/^(\w+)\s*\(([\s\S]*)\)$/)
  if (!match) return null

  const funcName = match[1]
  const argsStr = match[2].trim()

  if (!argsStr) {
    return { name: funcName, args: [] }
  }

  // 按逗号分割参数，同时考虑括号嵌套（如 max(a, min(b, c))）
  const args: string[] = []
  let depth = 0
  let current = ''
  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i]
    if (ch === '(') {
      depth++
      current += ch
    } else if (ch === ')') {
      depth--
      current += ch
    } else if (ch === ',' && depth === 0) {
      args.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) {
    args.push(current)
  }

  return { name: funcName, args }
}

/**
 * 从表达式中提取第一个用户自定义函数调用。
 * 跟踪括号平衡以确保正确提取嵌套调用（如 fib(fib(2))）。
 * 返回调用信息及表达式的前后部分，用于字面量替换。
 */
function extractFirstUserCall(
  expr: string,
  userFuncNames: Set<string>,
): { name: string; argStr: string; before: string; after: string; fullMatch: string } | null {
  for (const name of userFuncNames) {
    // 匹配函数名后跟开括号（如 "fib(" 或 "fib ("）
    const regex = new RegExp(`\\b${name}\\s*\\(`)
    const match = regex.exec(expr)
    if (!match) continue

    const startIdx = match.index
    // 定位开括号位置
    const openParenIdx = match.index + match[0].length - 1

    // 跟踪括号平衡找到匹配的闭括号
    let depth = 0
    let closeIdx = -1
    for (let i = openParenIdx; i < expr.length; i++) {
      if (expr[i] === '(') depth++
      else if (expr[i] === ')') {
        depth--
        if (depth === 0) {
          closeIdx = i
          break
        }
      }
    }

    if (closeIdx === -1) continue

    const fullMatch = expr.substring(startIdx, closeIdx + 1)
    const before = expr.substring(0, startIdx)
    const after = expr.substring(closeIdx + 1)
    const argStr = expr.substring(openParenIdx + 1, closeIdx)

    return { name, argStr, before, after, fullMatch }
  }
  return null
}

/**
 * 按逗号分割参数列表，同时考虑括号嵌套。
 * 用于解析从表达式中提取的函数调用参数字符串。
 */
function splitCallArgs(argStr: string): string[] {
  const args: string[] = []
  let depth = 0
  let current = ''
  for (let i = 0; i < argStr.length; i++) {
    const ch = argStr[i]
    if (ch === '(') {
      depth++
      current += ch
    } else if (ch === ')') {
      depth--
      current += ch
    } else if (ch === ',' && depth === 0) {
      args.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) {
    args.push(current)
  }
  return args
}

/**
 * 便捷包装器：用当前作用域的变量 + 用户自定义函数求值表达式。
 * 使 evaluateExpression 调用中自动注入 _syncFunctions。
 */
function evaluateExpr(expr: string, state: RuntimeState): unknown {
  return evaluateExpression(expr, state.variables, state._syncFunctions)
}

// ============================================================
// createInterpreter
// ============================================================

export function createInterpreter(program: Program): {
  state: RuntimeState
  generator: AsyncGenerator<InterpreterEvent>
} {
  const state: RuntimeState = {
    variables: {},
    variableTypes: {},
    callFrames: [],
    output: [],
    currentStatement: null,
    currentNodeId: null,
    currentFunctionName: 'Main',
    _program: program,
  }

  // 预先扫描 Main 函数体中所有 declare 语句，收集类型信息
  const mainFunc = program.functions.find((f) => f.name === 'Main')
  if (mainFunc) {
    collectDeclarations(mainFunc.body, state)
  }

  // 预构建同步函数包装器（供表达式中的递归/交叉调用）
  state._syncFunctions = buildSyncFunctionWrappers(program, state)

  const generator = runProgram(program, state)
  return { state, generator }
}

/**
 * 递归扫描所有 declare 语句，初始化变量类型和默认值
 */
function collectDeclarations(statements: Statement[], state: RuntimeState): void {
  if (!statements || !Array.isArray(statements)) return
  for (const stmt of statements) {
    if (stmt.kind === 'declare') {
      const names = splitDeclareNames(stmt.name)
      const flowType = stmt.type || 'Integer'
      // 数组类型附加 [] 后缀，便于后续区分标量/数组
      const typeTag = stmt.array ? flowType + '[]' : flowType
      for (const name of names) {
        if (name && !(name in state.variableTypes)) {
          state.variableTypes[name] = typeTag
          // 不在此处设置 state.variables —— 变量只在 declare 实际执行时才加入追踪
        }
      }
    } else if (stmt.kind === 'if') {
      collectDeclarations(stmt.thenBranch, state)
      collectDeclarations(stmt.elseBranch, state)
    } else if (stmt.kind === 'for' || stmt.kind === 'while' || stmt.kind === 'do') {
      collectDeclarations(stmt.body, state)
    }
  }
}

/**
 * 构建用户自定义函数的同步包装器映射。
 * 每个包装器捕获 funcDef、program、state，在求值表达式时注入作用域。
 * Main 函数排除 —— 不能作为子函数调用。
 */
function buildSyncFunctionWrappers(
  program: Program,
  state: RuntimeState,
): EvalFunctions {
  const wrappers: EvalFunctions = {}
  for (const funcDef of program.functions) {
    if (funcDef.name === 'Main') continue
    wrappers[funcDef.name] = (...args: unknown[]) => {
      return executeFunctionSync(funcDef, args, program, state)
    }
  }
  return wrappers
}

// ============================================================
// Generator: 主程序执行
// ============================================================

async function* runProgram(
  program: Program,
  state: RuntimeState,
): AsyncGenerator<InterpreterEvent> {
  const mainFunc = program.functions.find((f) => f.name === 'Main')
  if (!mainFunc) {
    yield { type: 'error', message: t('engine.error.noMainFunction') }
    return
  }

  try {
    yield* executeBlock(mainFunc.body, state)
    yield { type: 'done' }
  } catch (e: unknown) {
    if (e instanceof StopExecution) {
      yield { type: 'done' }
      return
    }
    const msg = e instanceof Error ? e.message : String(e)
    yield {
      type: 'error',
      message: msg,
      statement: state.currentStatement ?? undefined,
    }
  }
}

// ============================================================
// 语句块执行
// ============================================================

async function* executeBlock(
  statements: Statement[],
  state: RuntimeState,
): AsyncGenerator<InterpreterEvent> {
  if (!statements || !Array.isArray(statements)) return
  for (const stmt of statements) {
    yield* executeStatement(stmt, state)
  }
}

async function* executeStatement(
  stmt: Statement,
  state: RuntimeState,
): AsyncGenerator<InterpreterEvent> {
  const nodeId = (stmt as any)._nodeId as string | undefined
  state.currentStatement = stmt
  state.currentNodeId = nodeId ?? null

  // 复合语句（if/while/for/do）不在 executeStatement 层面包裹 enter/leave
  // 由各自的执行器在条件求值阶段自行发出，使得父节点仅在"做判断"时高亮
  const isCompound = stmt.kind === 'if' || stmt.kind === 'while' || stmt.kind === 'for' || stmt.kind === 'do'

  // 进入语句（仅叶子语句在此发出 enter）
  if (nodeId && !isCompound) {
    yield { type: 'statement-enter', statement: stmt, nodeId }
  }

  try {
    switch (stmt.kind) {
      case 'declare':
        yield* executeDeclare(stmt, state)
        break
      case 'assign':
        yield* executeAssign(stmt, state)
        break
      case 'input':
        yield* executeInput(stmt, state)
        break
      case 'output':
        yield* executeOutput(stmt, state)
        break
      case 'call':
        yield* executeCall(stmt, state)
        break
      case 'if':
        yield* executeIf(stmt, state)
        break
      case 'while':
        yield* executeWhile(stmt, state)
        break
      case 'for':
        yield* executeFor(stmt, state)
        break
      case 'do':
        yield* executeDo(stmt, state)
        break
      case 'more':
        // 占位节点，无操作
        break
    }
  } finally {
    // 离开语句（仅叶子语句在此发出 leave）
    if (nodeId && !isCompound) {
      yield { type: 'statement-leave', statement: stmt, nodeId }
    }
    state.currentStatement = null
    state.currentNodeId = null
  }
}

// ============================================================
// 各语句执行器
// ============================================================

async function* executeDeclare(
  stmt: Statement & { kind: 'declare' },
  state: RuntimeState,
): AsyncGenerator<InterpreterEvent> {
  const names = splitDeclareNames(stmt.name)
  if (names.length === 0 || !names.some((n) => n)) {
    yield { type: 'error', message: t('engine.error.declareMissingName'), statement: stmt }
    return
  }
  const flowType = stmt.type || 'Integer'

  // ----------------------------------------------------------
  // 数组声明
  // ----------------------------------------------------------
  if (stmt.array) {
    for (const name of names) {
      if (!name) continue
      state.variableTypes[name] = flowType + '[]'
      if (name in state.variables) continue // 不覆盖已有变量

      if (stmt.expression) {
        const resolvedExpr = yield* resolveExpression(stmt.expression, state)
        const result = evaluateExpr(resolvedExpr, state)

        if (Array.isArray(result)) {
          // 数组字面量初始化 → 直接赋值，自动确定长度
          state.variables[name] = result
        } else {
          // 标量表达式 → 创建 size 长度的数组并填充该值
          const sizeValue = evaluateExpr(stmt.size || '0', state)
          const size = Math.max(0, Math.floor(Number(sizeValue)))
          if (isNaN(size) || !isFinite(size)) {
            throw new Error(t('engine.error.arraySizeInvalid', { name, size: stmt.size }))
          }
          if (size > 1_000_000) {
            throw new Error(t('engine.error.arraySizeExceeded', { name, size }))
          }
          const val = coerceValue(result, flowType)
          state.variables[name] = new Array(size).fill(val)
        }
      } else {
        // 无初始化表达式 → 默认值填充
        const sizeValue = evaluateExpr(stmt.size || '0', state)
        const size = Math.max(0, Math.floor(Number(sizeValue)))
        if (isNaN(size) || !isFinite(size)) {
          throw new Error(t('engine.error.arraySizeInvalid', { name, size: stmt.size }))
        }
        if (size > 1_000_000) {
          throw new Error(t('engine.error.arraySizeExceeded', { name, size }))
        }
        const defaultValue = defaultValueForType(flowType)
        state.variables[name] = new Array(size).fill(defaultValue)
      }
    }
    return
  }

  // ----------------------------------------------------------
  // 标量声明
  // ----------------------------------------------------------
  for (const name of names) {
    if (!name) continue
    state.variableTypes[name] = flowType
    if (name in state.variables) continue // 不覆盖已有变量

    if (stmt.expression) {
      const resolvedExpr = yield* resolveExpression(stmt.expression, state)
      const result = evaluateExpr(resolvedExpr, state)
      state.variables[name] = coerceValue(result, flowType)
    } else {
      state.variables[name] = defaultValueForType(flowType)
    }
  }
}

async function* executeAssign(
  stmt: Statement & { kind: 'assign' },
  state: RuntimeState,
): AsyncGenerator<InterpreterEvent> {
  if (!stmt.variable) {
    yield { type: 'error', message: t('engine.error.assignMissingTarget'), statement: stmt }
    return
  }
  if (!stmt.expression) {
    yield { type: 'error', message: t('engine.error.assignMissingExpression'), statement: stmt }
    return
  }

  // 预处理：将用户自定义函数调用替换为字面量（产生子窗口事件）
  const resolvedExpr = yield* resolveExpression(stmt.expression, state)
  const value = evaluateExpr(resolvedExpr, state)

  // 解析数组下标：如 "arr[0]" → name="arr", indexExpr="0"
  const access = parseArrayAccess(stmt.variable)

  if (access.indexExpr !== null) {
    // --- 数组元素赋值 ---
    const { name, indexExpr } = access
    const arr = state.variables[name]
    if (!Array.isArray(arr)) {
      throw new Error(t('engine.error.notArray', { name }))
    }
    const rawIndex = evaluateExpr(indexExpr!, state)
    const index = Math.floor(Number(rawIndex))
    if (isNaN(index) || !isFinite(index)) {
      throw new Error(`数组 "${name}" 的索引无效: ${indexExpr}`)
    }
    if (index < 0 || index >= arr.length) {
      throw new Error(
        t('engine.error.indexOutOfBounds', { name, index, size: arr.length }),
      )
    }
    // 从 variableTypes 中推断元素类型（去掉 [] 后缀）
    const elemType = (state.variableTypes[name] || '').replace(/\[\]$/, '')
    arr[index] = coerceValue(value, elemType)
  } else {
    // --- 普通标量赋值 ---
    const varType = state.variableTypes[stmt.variable] || ''
    state.variables[stmt.variable] = coerceValue(value, varType)
  }
}

async function* executeInput(
  stmt: Statement & { kind: 'input' },
  state: RuntimeState,
): AsyncGenerator<InterpreterEvent> {
  if (!stmt.variable) return

  // yield input-request → 外部显示对话框 → resolve 后继续

  // 通过 event 通知外部需要输入
  yield { type: 'input-request', variable: stmt.variable }

  // 外部已通过 resolveInput 设置值（在 state 的 _pendingInput 字段）
  const inputValue = (state as any)._pendingInput as string | undefined
  delete (state as any)._pendingInput

  if (inputValue === undefined) {
    // 用户取消了输入或终止了执行
    throw new StopExecution(t('engine.error.inputCancelled'))
  }

  // 解析数组下标
  const access = parseArrayAccess(stmt.variable)

  if (access.indexExpr !== null) {
    // --- 数组元素输入 ---
    const { name, indexExpr } = access
    const arr = state.variables[name]
    if (!Array.isArray(arr)) {
      throw new Error(t('engine.error.notArray', { name }))
    }
    const rawIndex = evaluateExpr(indexExpr!, state)
    const index = Math.floor(Number(rawIndex))
    if (isNaN(index) || !isFinite(index)) {
      throw new Error(t('engine.error.indexInvalid', { name, indexExpr }))
    }
    if (index < 0 || index >= arr.length) {
      throw new Error(
        t('engine.error.indexOutOfBounds', { name, index, size: arr.length }),
      )
    }
    const elemType = (state.variableTypes[name] || '').replace(/\[\]$/, '')
    arr[index] = coerceValue(inputValue, elemType)
    // 如果类型是 String，保留原始输入
    if (elemType === 'String') {
      arr[index] = inputValue
    }
  } else {
    // --- 普通标量输入 ---
    const varType = state.variableTypes[stmt.variable] || ''
    state.variables[stmt.variable] = coerceValue(inputValue, varType)
    // 如果类型是 String，保留原始输入
    if (varType === 'String') {
      state.variables[stmt.variable] = inputValue
    }
  }
}

async function* executeOutput(
  stmt: Statement & { kind: 'output' },
  state: RuntimeState,
): AsyncGenerator<InterpreterEvent> {
  if (!stmt.expression) return

  // 预处理：将用户自定义函数调用替换为字面量（产生子窗口事件）
  const resolvedExpr = yield* resolveExpression(stmt.expression, state)
  const value = evaluateExpr(resolvedExpr, state)
  const text = formatOutputValue(value, stmt.newline)
  state.output.push(text)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeId = (stmt as any)._nodeId as string | undefined
  yield { type: 'output', text, nodeId }
}

async function* executeCall(
  stmt: Statement & { kind: 'call' },
  state: RuntimeState,
): AsyncGenerator<InterpreterEvent> {
  if (!stmt.expression) return

  // 尝试解析调用表达式：提取函数名和参数列表
  const parsed = parseCallExpression(stmt.expression)
  if (!parsed) {
    // 无法解析，回退到表达式求值
    try {
      evaluateExpr(stmt.expression, state)
    } catch { /* 忽略 */ }
    return
  }

  // 查找用户定义的函数
  const program = state._program
  const funcDef = program?.functions.find((f) => f.name === parsed.name)

  if (!funcDef || funcDef.name === 'Main') {
    // 不是用户函数（或不能调用 Main），回退到表达式求值
    // 用于 Math.sqrt、Random 等内置调用
    try {
      evaluateExpr(stmt.expression, state)
    } catch { /* 忽略 */ }
    return
  }

  // ==========================================
  // 执行用户定义的函数
  // ==========================================

  // 1. 求值参数表达式（在调用者作用域中）
  // 先预处理表达式中的用户自定义函数调用，确保子窗口可视化
  const argValues: unknown[] = []
  for (const argExpr of parsed.args) {
    const trimmed = argExpr.trim()
    if (trimmed) {
      const resolved = yield* resolveExpression(trimmed, state)
      argValues.push(evaluateExpr(resolved, state))
    } else {
      argValues.push(undefined)
    }
  }

  // 2. 创建新作用域
  const newVars: Record<string, unknown> = {}
  const newTypes: Record<string, string> = {}

  // 绑定参数
  for (let i = 0; i < funcDef.parameters.length; i++) {
    const param = funcDef.parameters[i]
    const rawValue = i < argValues.length ? argValues[i] : undefined
    const value = rawValue !== undefined && rawValue !== null
      ? coerceValue(rawValue, param.type)
      : defaultValueForType(param.type)

    newVars[param.name] = param.array ? (Array.isArray(value) ? value : [value]) : value
    newTypes[param.name] = param.array ? param.type + '[]' : param.type
  }

  // 预扫描函数体中的 declare
  collectDeclarations(funcDef.body, { variables: newVars, variableTypes: newTypes } as RuntimeState)

  // 3. 保存调用者作用域，切换到被调用者作用域
  const callerName = state.currentFunctionName
  const callerFrame: CallFrame = {
    funcName: callerName,
    variables: state.variables,
    variableTypes: state.variableTypes,
  }
  state.callFrames.push(callerFrame)
  state.variables = newVars
  state.variableTypes = newTypes

  // 4. 执行函数体（包裹 function-enter / function-leave 事件）
  state.currentFunctionName = funcDef.name
  yield { type: 'function-enter', functionName: funcDef.name }

  try {
    yield* executeBlock(funcDef.body, state)
    yield { type: 'function-leave', functionName: funcDef.name }
  } catch (e: unknown) {
    // 异常时也 yield function-leave，确保调用栈正确弹出
    yield { type: 'function-leave', functionName: funcDef.name }
    state.currentFunctionName = callerName
    const frame = state.callFrames.pop()
    if (frame) {
      state.variables = frame.variables
      state.variableTypes = frame.variableTypes
    }
    throw e
  }

  state.currentFunctionName = callerName

  // 5. 捕获返回值
  const returnValue = funcDef.variable
    ? state.variables[funcDef.variable]
    : undefined

  // 6. 恢复调用者作用域
  const poppedFrame = state.callFrames.pop()
  if (poppedFrame) {
    state.variables = poppedFrame.variables
    state.variableTypes = poppedFrame.variableTypes
  }

  // 7. 将返回值存入调用者作用域的 result 变量（如果指定）
  if (stmt.result && returnValue !== undefined) {
    state.variables[stmt.result] = returnValue
    state.variableTypes[stmt.result] = funcDef.type
  }
}

// ============================================================
// 表达式预处理：将用户自定义函数调用替换为字面量结果
// （通过异步 Generator 执行函数，产生 function-enter/leave 事件）
// ============================================================

/**
 * 异步执行一个用户自定义函数（用于表达式中的函数调用）。
 * 镜像 executeCall 的核心逻辑但跳过表达式解析步骤。
 * 产生 function-enter / function-leave 事件以实现子窗口可视化。
 */
async function* executeFunctionFromExpression(
  funcDef: FunctionDef,
  args: unknown[],
  state: RuntimeState,
): AsyncGenerator<InterpreterEvent, unknown> {
  // 1. 创建新作用域并绑定参数
  const newVars: Record<string, unknown> = {}
  const newTypes: Record<string, string> = {}

  for (let i = 0; i < funcDef.parameters.length; i++) {
    const param = funcDef.parameters[i]
    const rawValue = i < args.length ? args[i] : undefined
    const value = rawValue !== undefined && rawValue !== null
      ? coerceValue(rawValue, param.type)
      : defaultValueForType(param.type)

    newVars[param.name] = param.array ? (Array.isArray(value) ? value : [value]) : value
    newTypes[param.name] = param.array ? param.type + '[]' : param.type
  }

  // 预扫描函数体中的 declare
  collectDeclarations(funcDef.body, { variables: newVars, variableTypes: newTypes } as RuntimeState)

  // 2. 保存调用者作用域，切换到被调用者作用域
  const callerName = state.currentFunctionName
  const callerFrame: CallFrame = {
    funcName: callerName,
    variables: state.variables,
    variableTypes: state.variableTypes,
  }
  state.callFrames.push(callerFrame)
  state.variables = newVars
  state.variableTypes = newTypes

  // 3. 执行函数体（包裹 function-enter / function-leave 事件）
  state.currentFunctionName = funcDef.name
  yield { type: 'function-enter', functionName: funcDef.name }

  try {
    yield* executeBlock(funcDef.body, state)
    yield { type: 'function-leave', functionName: funcDef.name }
  } catch (e: unknown) {
    // 异常时也 yield function-leave，确保调用栈正确弹出
    yield { type: 'function-leave', functionName: funcDef.name }
    state.currentFunctionName = callerName
    const frame = state.callFrames.pop()
    if (frame) {
      state.variables = frame.variables
      state.variableTypes = frame.variableTypes
    }
    throw e
  }

  state.currentFunctionName = callerName

  // 4. 捕获返回值
  const returnValue = funcDef.variable
    ? state.variables[funcDef.variable]
    : undefined

  // 5. 恢复调用者作用域
  const poppedFrame = state.callFrames.pop()
  if (poppedFrame) {
    state.variables = poppedFrame.variables
    state.variableTypes = poppedFrame.variableTypes
  }

  return returnValue
}

/**
 * 将表达式中的用户自定义函数调用替换为字面量结果。
 *
 * 循环处理直到表达式中无用户函数调用：
 * 1. 找到第一个用户函数调用（跟踪括号平衡）
 * 2. 递归解析参数表达式中的嵌套调用
 * 3. 通过异步 Generator 执行函数（产生 function-enter/leave 事件）
 * 4. 在原表达式中用字面量结果替换该调用
 *
 * @param expr 原始表达式字符串
 * @param state 运行时状态
 * @returns 不含用户函数调用的简化表达式（可直接用 evaluateExpr 求值）
 */
async function* resolveExpression(
  expr: string,
  state: RuntimeState,
): AsyncGenerator<InterpreterEvent, string> {
  const program = state._program
  if (!program) return expr

  // 收集用户自定义函数名（排除 Main）
  const userFuncNames = new Set(
    program.functions.filter((f) => f.name !== 'Main').map((f) => f.name),
  )

  if (userFuncNames.size === 0) return expr

  let result = expr

  while (true) {
    const call = extractFirstUserCall(result, userFuncNames)
    if (!call) break

    // 解析参数表达式
    const argStrs = splitCallArgs(call.argStr)

    // 递归解析每个参数表达式（处理嵌套调用）
    const resolvedArgExprs: string[] = []
    for (const argStr of argStrs) {
      const trimmed = argStr.trim()
      if (trimmed) {
        // 递归解析参数中的用户函数调用
        const resolved = yield* resolveExpression(trimmed, state)
        resolvedArgExprs.push(resolved)
      } else {
        resolvedArgExprs.push('')
      }
    }

    // 求值已解析的参数表达式（此时只含字面量、变量、内置函数）
    const argValues: unknown[] = resolvedArgExprs.map((resolved) => {
      const trimmed = resolved.trim()
      return trimmed ? evaluateExpr(trimmed, state) : undefined
    })

    // 查找函数定义
    const funcDef = program.functions.find((f) => f.name === call.name)!
    if (!funcDef) {
      // 不应该发生，但安全回退
      break
    }

    // 通过异步 Generator 执行函数（产生 function-enter/leave 事件）
    const returnValue = yield* executeFunctionFromExpression(funcDef, argValues, state)

    // 将调用替换为字面量结果
    const replacement = valueToLiteralString(returnValue)
    result = call.before + replacement + call.after
  }

  return result
}

/**
 * 将 JavaScript 值转换为可在表达式中作为字面量使用的字符串。
 * 数字 → 数字字符串，字符串 → 引号包裹，布尔 → true/false。
 */
function valueToLiteralString(value: unknown): string {
  if (typeof value === 'string') {
    // 转义字符串中的双引号和反斜杠
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return `"${escaped}"`
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (value === null || value === undefined) {
    return '0'
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '0'
  }
  return String(value)
}

async function* executeIf(
  stmt: IfStatement,
  state: RuntimeState,
): AsyncGenerator<InterpreterEvent> {
  const nodeId = (stmt as any)._nodeId as string | undefined

  if (!stmt.expression) {
    yield { type: 'error', message: t('engine.error.ifMissingCondition'), statement: stmt }
    return
  }

  // 仅在条件求值时高亮 if 节点
  if (nodeId) {
    state.currentStatement = stmt
    state.currentNodeId = nodeId
    yield { type: 'statement-enter', statement: stmt, nodeId }
  }

  // 预处理：将用户自定义函数调用替换为字面量（产生子窗口事件）
  const resolvedCond = yield* resolveExpression(stmt.expression, state)
  const cond = evaluateExpr(resolvedCond, state)

  if (nodeId) {
    yield { type: 'statement-leave', statement: stmt, nodeId }
    state.currentStatement = null
    state.currentNodeId = null
  }

  if (cond) {
    yield* executeBlock(stmt.thenBranch, state)
  } else {
    yield* executeBlock(stmt.elseBranch, state)
  }
}

async function* executeWhile(
  stmt: WhileStatement,
  state: RuntimeState,
): AsyncGenerator<InterpreterEvent> {
  const nodeId = (stmt as any)._nodeId as string | undefined

  if (!stmt.expression) {
    yield { type: 'error', message: t('engine.error.whileMissingCondition'), statement: stmt }
    return
  }

  let iterations = 0
  while (true) {
    if (++iterations > MAX_ITERATIONS) {
      yield { type: 'error', message: t('engine.error.loopMaxIterations', { kind: 'while', max: MAX_ITERATIONS }), statement: stmt }
      return
    }

    // 每次循环条件求值时高亮 while 节点
    if (nodeId) {
      state.currentStatement = stmt
      state.currentNodeId = nodeId
      yield { type: 'statement-enter', statement: stmt, nodeId }
    }

    // 预处理：将用户自定义函数调用替换为字面量（产生子窗口事件）
    const resolvedCond = yield* resolveExpression(stmt.expression, state)
    const cond = evaluateExpr(resolvedCond, state)

    if (nodeId) {
      yield { type: 'statement-leave', statement: stmt, nodeId }
      state.currentStatement = null
      state.currentNodeId = null
    }

    if (!cond) break
    yield* executeBlock(stmt.body, state)
  }
}

async function* executeFor(
  stmt: ForStatement,
  state: RuntimeState,
): AsyncGenerator<InterpreterEvent> {
  const nodeId = (stmt as any)._nodeId as string | undefined
  // 初始化循环变量
  const varName = stmt.variable
  if (!varName) return

  // 预处理：将用户自定义函数调用替换为字面量（产生子窗口事件）
  const resolvedStart = stmt.start ? (yield* resolveExpression(stmt.start, state)) : '0'
  const resolvedEnd = stmt.end ? (yield* resolveExpression(stmt.end, state)) : '0'
  const resolvedStep = stmt.step ? (yield* resolveExpression(stmt.step, state)) : '1'
  const startVal = evaluateExpr(resolvedStart, state)
  const endVal = evaluateExpr(resolvedEnd, state)
  const stepVal = evaluateExpr(resolvedStep, state)

  // 推断循环变量类型
  state.variableTypes[varName] = state.variableTypes[varName] || 'Integer'
  state.variables[varName] = coerceValue(startVal, state.variableTypes[varName])

  const step = Number(stepVal) || 1
  const end = Number(endVal) || 0

  let iterations = 0
  while (true) {
    if (++iterations > MAX_ITERATIONS) {
      yield { type: 'error', message: t('engine.error.loopMaxIterations', { kind: 'for', max: MAX_ITERATIONS }), statement: stmt }
      return
    }

    const current = Number(state.variables[varName])

    // 每次迭代条件判断时高亮 for 节点
    if (nodeId) {
      state.currentStatement = stmt
      state.currentNodeId = nodeId
      yield { type: 'statement-enter', statement: stmt, nodeId }
    }

    const shouldBreak = step > 0 ? current > end : current < end

    if (nodeId) {
      yield { type: 'statement-leave', statement: stmt, nodeId }
      state.currentStatement = null
      state.currentNodeId = null
    }

    if (shouldBreak) break

    yield* executeBlock(stmt.body, state)

    // 递增循环变量
    state.variables[varName] = current + step
  }
}

async function* executeDo(
  stmt: Statement & { kind: 'do' },
  state: RuntimeState,
): AsyncGenerator<InterpreterEvent> {
  const nodeId = (stmt as any)._nodeId as string | undefined

  if (!stmt.expression) {
    yield { type: 'error', message: t('engine.error.doMissingCondition'), statement: stmt }
    return
  }

  let iterations = 0
  do {
    if (++iterations > MAX_ITERATIONS) {
      yield { type: 'error', message: t('engine.error.loopMaxIterations', { kind: 'do', max: MAX_ITERATIONS }), statement: stmt }
      return
    }
    yield* executeBlock(stmt.body, state)

    // do-while 在 body 执行后才做条件判断
    if (nodeId) {
      state.currentStatement = stmt
      state.currentNodeId = nodeId
      yield { type: 'statement-enter', statement: stmt, nodeId }
    }

    // 预处理：将用户自定义函数调用替换为字面量（产生子窗口事件）
    const resolvedCond = yield* resolveExpression(stmt.expression, state)
    const cond = evaluateExpr(resolvedCond, state)

    if (nodeId) {
      yield { type: 'statement-leave', statement: stmt, nodeId }
      state.currentStatement = null
      state.currentNodeId = null
    }

    if (!cond) break
  } while (true)
}

// ============================================================
// 同步函数执行器（供表达式中的函数调用使用）
//
// 这些函数是异步 Generator 执行器的同步镜像，用于
// evaluateExpression → 用户自定义函数包装器 → 同步执行函数体。
// 不产生事件、不检查暂停、不修改 state.callFrames。
// ============================================================

/**
 * 同步执行一个用户自定义函数，返回其返回值。
 * 保存/恢复调用者作用域，JS 调用栈天然提供递归深度。
 */
function executeFunctionSync(
  funcDef: FunctionDef,
  args: unknown[],
  program: Program,
  state: RuntimeState,
): unknown {
  // 递归深度守卫：防止无限递归导致的栈溢出
  const depth = (state._syncRecursionDepth ?? 0) + 1
  if (depth > MAX_SYNC_RECURSION_DEPTH) {
    throw new Error(
      t('engine.error.syncRecursionDepthExceeded', { max: String(MAX_SYNC_RECURSION_DEPTH) }),
    )
  }
  state._syncRecursionDepth = depth

  try {
    // 1. 创建新作用域并绑定参数
    const newVars: Record<string, unknown> = {}
  const newTypes: Record<string, string> = {}

  for (let i = 0; i < funcDef.parameters.length; i++) {
    const param = funcDef.parameters[i]
    const rawValue = i < args.length ? args[i] : undefined
    const value = rawValue !== undefined && rawValue !== null
      ? coerceValue(rawValue, param.type)
      : defaultValueForType(param.type)

    newVars[param.name] = param.array ? (Array.isArray(value) ? value : [value]) : value
    newTypes[param.name] = param.array ? param.type + '[]' : param.type
  }

  // 2. 预扫描函数体中的 declare（类型信息 + 默认值）
  collectDeclarations(funcDef.body, { variables: newVars, variableTypes: newTypes } as RuntimeState)

  // 3. 保存调用者作用域
  const savedVars = state.variables
  const savedTypes = state.variableTypes

  // 4. 切换到被调用者作用域
  state.variables = newVars
  state.variableTypes = newTypes

  let returnValue: unknown = undefined

  try {
    executeBlockSync(funcDef.body, program, state)

    // 5. 捕获返回值（仅在成功路径）
    if (funcDef.variable) {
      returnValue = state.variables[funcDef.variable]
    }
    } finally {
      // 6. 始终恢复调用者作用域
      state.variables = savedVars
      state.variableTypes = savedTypes
    }

    return returnValue
  } finally {
    // 7. 始终递减递归深度
    state._syncRecursionDepth = (state._syncRecursionDepth ?? 1) - 1
  }
}

/** 同步遍历语句列表并分发执行 */
function executeBlockSync(
  statements: Statement[],
  program: Program,
  state: RuntimeState,
): void {
  if (!statements || !Array.isArray(statements)) return
  for (const stmt of statements) {
    executeStatementSync(stmt, program, state)
  }
}

/** 同步分发单条语句 */
function executeStatementSync(
  stmt: Statement,
  program: Program,
  state: RuntimeState,
): void {
  switch (stmt.kind) {
    case 'declare':
      executeDeclareSync(stmt, state)
      break
    case 'assign':
      executeAssignSync(stmt, state)
      break
    case 'if':
      executeIfSync(stmt, program, state)
      break
    case 'while':
      executeWhileSync(stmt, program, state)
      break
    case 'for':
      executeForSync(stmt, program, state)
      break
    case 'do':
      executeDoSync(stmt, program, state)
      break
    case 'call':
      executeCallSync(stmt, program, state)
      break
    case 'output':
      // no-op：显示输出与表达式求值无关
      break
    case 'input':
      throw new Error(t('engine.error.inputDuringExpressionEval'))
    case 'more':
      // 占位节点，无操作
      break
  }
}

/** 同步执行 declare 语句 */
function executeDeclareSync(
  stmt: Statement & { kind: 'declare' },
  state: RuntimeState,
): void {
  const names = splitDeclareNames(stmt.name)
  if (names.length === 0 || !names.some((n) => n)) return
  const flowType = stmt.type || 'Integer'

  // ----------------------------------------------------------
  // 数组声明
  // ----------------------------------------------------------
  if (stmt.array) {
    for (const name of names) {
      if (!name) continue
      state.variableTypes[name] = flowType + '[]'
      if (name in state.variables) continue

      if (stmt.expression) {
        const result = evaluateExpr(stmt.expression, state)

        if (Array.isArray(result)) {
          state.variables[name] = result
        } else {
          const sizeValue = evaluateExpr(stmt.size || '0', state)
          const size = Math.max(0, Math.floor(Number(sizeValue)))
          if (isNaN(size) || !isFinite(size)) {
            throw new Error(t('engine.error.arraySizeInvalid', { name, size: stmt.size }))
          }
          if (size > 1_000_000) {
            throw new Error(t('engine.error.arraySizeExceeded', { name, size }))
          }
          const val = coerceValue(result, flowType)
          state.variables[name] = new Array(size).fill(val)
        }
      } else {
        const sizeValue = evaluateExpr(stmt.size || '0', state)
        const size = Math.max(0, Math.floor(Number(sizeValue)))
        if (isNaN(size) || !isFinite(size)) {
          throw new Error(t('engine.error.arraySizeInvalid', { name, size: stmt.size }))
        }
        if (size > 1_000_000) {
          throw new Error(t('engine.error.arraySizeExceeded', { name, size }))
        }
        const defaultValue = defaultValueForType(flowType)
        state.variables[name] = new Array(size).fill(defaultValue)
      }
    }
    return
  }

  // ----------------------------------------------------------
  // 标量声明
  // ----------------------------------------------------------
  for (const name of names) {
    if (!name) continue
    state.variableTypes[name] = flowType
    if (name in state.variables) continue

    if (stmt.expression) {
      const result = evaluateExpr(stmt.expression, state)
      state.variables[name] = coerceValue(result, flowType)
    } else {
      state.variables[name] = defaultValueForType(flowType)
    }
  }
}

/** 同步执行 assign 语句 */
function executeAssignSync(
  stmt: Statement & { kind: 'assign' },
  state: RuntimeState,
): void {
  if (!stmt.variable || !stmt.expression) return

  const value = evaluateExpr(stmt.expression, state)
  const access = parseArrayAccess(stmt.variable)

  if (access.indexExpr !== null) {
    const { name, indexExpr } = access
    const arr = state.variables[name]
    if (!Array.isArray(arr)) {
      throw new Error(t('engine.error.notArray', { name }))
    }
    const rawIndex = evaluateExpr(indexExpr!, state)
    const index = Math.floor(Number(rawIndex))
    if (isNaN(index) || !isFinite(index)) {
      throw new Error(`数组 "${name}" 的索引无效: ${indexExpr}`)
    }
    if (index < 0 || index >= arr.length) {
      throw new Error(
        t('engine.error.indexOutOfBounds', { name, index, size: arr.length }),
      )
    }
    const elemType = (state.variableTypes[name] || '').replace(/\[\]$/, '')
    arr[index] = coerceValue(value, elemType)
  } else {
    const varType = state.variableTypes[stmt.variable] || ''
    state.variables[stmt.variable] = coerceValue(value, varType)
  }
}

/** 同步执行 if 语句 */
function executeIfSync(
  stmt: IfStatement,
  program: Program,
  state: RuntimeState,
): void {
  if (!stmt.expression) return
  const cond = evaluateExpr(stmt.expression, state)
  if (cond) {
    executeBlockSync(stmt.thenBranch, program, state)
  } else {
    executeBlockSync(stmt.elseBranch, program, state)
  }
}

/** 同步执行 while 语句（带 MAX_ITERATIONS 守卫） */
function executeWhileSync(
  stmt: WhileStatement,
  program: Program,
  state: RuntimeState,
): void {
  if (!stmt.expression) return
  let iterations = 0
  while (evaluateExpr(stmt.expression, state)) {
    if (++iterations > MAX_ITERATIONS) {
      throw new Error(
        t('engine.error.loopMaxIterations', { kind: 'while', max: MAX_ITERATIONS }),
      )
    }
    executeBlockSync(stmt.body, program, state)
  }
}

/** 同步执行 for 语句（带 MAX_ITERATIONS 守卫） */
function executeForSync(
  stmt: ForStatement,
  program: Program,
  state: RuntimeState,
): void {
  const varName = stmt.variable
  if (!varName) return

  const startVal = evaluateExpr(stmt.start || '0', state)
  const endVal = evaluateExpr(stmt.end || '0', state)
  const stepVal = evaluateExpr(stmt.step || '1', state)

  state.variableTypes[varName] = state.variableTypes[varName] || 'Integer'
  state.variables[varName] = coerceValue(startVal, state.variableTypes[varName])

  const step = Number(stepVal) || 1
  const end = Number(endVal) || 0

  let iterations = 0
  while (true) {
    if (++iterations > MAX_ITERATIONS) {
      throw new Error(
        t('engine.error.loopMaxIterations', { kind: 'for', max: MAX_ITERATIONS }),
      )
    }

    const current = Number(state.variables[varName])
    const shouldBreak = step > 0 ? current > end : current < end
    if (shouldBreak) break

    executeBlockSync(stmt.body, program, state)
    state.variables[varName] = current + step
  }
}

/** 同步执行 do 语句（带 MAX_ITERATIONS 守卫） */
function executeDoSync(
  stmt: Statement & { kind: 'do' },
  program: Program,
  state: RuntimeState,
): void {
  if (!stmt.expression) return
  let iterations = 0
  do {
    if (++iterations > MAX_ITERATIONS) {
      throw new Error(
        t('engine.error.loopMaxIterations', { kind: 'do', max: MAX_ITERATIONS }),
      )
    }
    executeBlockSync(stmt.body, program, state)
  } while (evaluateExpr(stmt.expression, state))
}

/** 同步执行 call 语句 */
function executeCallSync(
  stmt: Statement & { kind: 'call' },
  program: Program,
  state: RuntimeState,
): void {
  if (!stmt.expression) return

  const parsed = parseCallExpression(stmt.expression)
  if (!parsed) {
    // 非调用表达式，回退到表达式求值
    try {
      evaluateExpr(stmt.expression, state)
    } catch { /* 忽略 */ }
    return
  }

  // 查找用户定义函数
  const funcDef = program.functions.find((f) => f.name === parsed.name)

  if (!funcDef || funcDef.name === 'Main') {
    // 内置函数或 Main，回退到表达式求值
    try {
      evaluateExpr(stmt.expression, state)
    } catch { /* 忽略 */ }
    return
  }

  // 在调用者作用域中求值参数
  const argValues: unknown[] = []
  for (const argExpr of parsed.args) {
    const trimmed = argExpr.trim()
    if (trimmed) {
      argValues.push(evaluateExpr(trimmed, state))
    } else {
      argValues.push(undefined)
    }
  }

  // 同步执行
  const returnValue = executeFunctionSync(funcDef, argValues, program, state)

  // 将返回值存入调用者作用域
  if (stmt.result && returnValue !== undefined) {
    state.variables[stmt.result] = returnValue
    state.variableTypes[stmt.result] = funcDef.type
  }
}

// ============================================================
// Utilities
// ============================================================

/** 格式化输出值为显示字符串 */
function formatOutputValue(value: unknown, _newline: boolean): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? t('execution.true') : t('execution.false')
  return String(value)
}

/**
 * 内部信号：用户取消输入或手动终止时抛出，中断执行流程。
 * 在 runProgram 的 catch 中捕获，yield done 事件。
 */
class StopExecution extends Error {
  constructor(message: string = '执行已终止') {
    super(message)
    this.name = 'StopExecution'
  }
}

/** 向解释器提供输入值（由 index.vue 在 InputDialog submit 后调用） */
export function resolveInput(state: RuntimeState, value: string): void {
  ;(state as any)._pendingInput = value
}

/** 终止执行（由 index.vue 在 stop 时调用） */
export function abortExecution(state: RuntimeState): void {
  ;(state as any)._pendingInput = undefined // 取消等待的输入
  // 标记终止：下一次 generator 迭代时会在 input-request 处检测到 undefined 而抛出 StopExecution
}
