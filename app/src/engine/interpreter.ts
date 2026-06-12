// ============================================================
// interpreter.ts — AST 解释器（异步 Generator）
//
// 遍历 AST Program，逐条执行语句，yield 运行时事件。
// 外部（index.vue）通过驱动 generator 来控制运行/步进/终止。
// ============================================================

import type { Program, Statement, IfStatement, WhileStatement, ForStatement } from './fprg-ast'
import { splitDeclareNames } from './fprg-ast'
import { evaluateExpression, coerceValue, defaultValueForType, parseArrayAccess } from './expression-evaluator'
import { i18n } from '../i18n'
const t = i18n.global.t

// ============================================================
// Types
// ============================================================

export interface RuntimeState {
  /** 变量名 → 当前值 */
  variables: Record<string, unknown>
  /** 变量名 → Flowgorithm 类型名 ("Integer"|"Real"|"String"|"Boolean") */
  variableTypes: Record<string, string>
  /** 输出行缓冲 */
  output: string[]
  /** 当前执行到的语句（null 表示未开始或已完成） */
  currentStatement: Statement | null
  /** 当前执行节点的 ID */
  currentNodeId: string | null
}

export type InterpreterEvent =
  | { type: 'statement-enter'; statement: Statement; nodeId: string }
  | { type: 'statement-leave'; statement: Statement; nodeId: string }
  | { type: 'output'; text: string; nodeId?: string }
  | { type: 'input-request'; variable: string }
  | { type: 'done' }
  | { type: 'error'; message: string; statement?: Statement }

// ============================================================
// Helpers
// ============================================================

const MAX_ITERATIONS = 10000

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
    output: [],
    currentStatement: null,
    currentNodeId: null,
  }

  // 预先扫描 Main 函数体中所有 declare 语句，收集类型信息
  const mainFunc = program.functions.find((f) => f.name === 'Main')
  if (mainFunc) {
    collectDeclarations(mainFunc.body, state)
  }

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
        const result = evaluateExpression(stmt.expression, state.variables)

        if (Array.isArray(result)) {
          // 数组字面量初始化 → 直接赋值，自动确定长度
          state.variables[name] = result
        } else {
          // 标量表达式 → 创建 size 长度的数组并填充该值
          const sizeValue = evaluateExpression(stmt.size || '0', state.variables)
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
        const sizeValue = evaluateExpression(stmt.size || '0', state.variables)
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
      const result = evaluateExpression(stmt.expression, state.variables)
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

  const value = evaluateExpression(stmt.expression, state.variables)

  // 解析数组下标：如 "arr[0]" → name="arr", indexExpr="0"
  const access = parseArrayAccess(stmt.variable)

  if (access.indexExpr !== null) {
    // --- 数组元素赋值 ---
    const { name, indexExpr } = access
    const arr = state.variables[name]
    if (!Array.isArray(arr)) {
      throw new Error(t('engine.error.notArray', { name }))
    }
    const rawIndex = evaluateExpression(indexExpr!, state.variables)
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
    const rawIndex = evaluateExpression(indexExpr!, state.variables)
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

  const value = evaluateExpression(stmt.expression, state.variables)
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
  // call 语句：求值表达式（通常为函数调用，有副作用）
  // 如 Math.sqrt(x), Random()
  if (stmt.expression) {
    try {
      evaluateExpression(stmt.expression, state.variables)
    } catch {
      // 忽略 call 的返回值（不赋值给变量）
      // call 主要用于函数副作用
    }
  }
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

  const cond = evaluateExpression(stmt.expression, state.variables)

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

    const cond = evaluateExpression(stmt.expression, state.variables)

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

  const startVal = evaluateExpression(stmt.start || '0', state.variables)
  const endVal = evaluateExpression(stmt.end || '0', state.variables)
  const stepVal = evaluateExpression(stmt.step || '1', state.variables)

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

    const cond = evaluateExpression(stmt.expression, state.variables)

    if (nodeId) {
      yield { type: 'statement-leave', statement: stmt, nodeId }
      state.currentStatement = null
      state.currentNodeId = null
    }

    if (!cond) break
  } while (true)
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
