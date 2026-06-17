// ============================================================
// scope-resolver.ts — 从 AST 中提取当前作用域内的变量列表
//
// 用于为 CodeEditor 自动补全提供"当前可用的变量"。
// Flowgorithm 的作用域是函数级别（无块级作用域），
// 因此所有在当前语句"之前"声明的变量均可见。
// ============================================================

import type { Statement, FunctionDef, DeclareStatement } from '../engine/fprg-ast'
import { splitDeclareNames } from '../engine/fprg-ast'

/**
 * 收集目标语句之前的、当前作用域内可见的所有变量名。
 *
 * 规则：
 *   1. 所属函数的参数名全部纳入
 *   2. 从函数体开头遍历到目标语句之前，收集所有 declare 变量名
 *   3. 遍历 assign 左值（若为简单变量名）也纳入（赋值即声明风格）
 *   4. For 循环的循环变量纳入
 *   5. 不包含目标语句自身的声明（编辑声明节点时不应建议自己）
 *
 * @param target   当前正在编辑的语句
 * @param allFunctions  程序中的所有函数定义
 * @returns 变量名字符串数组（去重）
 */
export function collectScopeVariables(
  target: Statement,
  allFunctions: FunctionDef[],
): string[] {
  const variables = new Set<string>()

  // 1. 找到所属函数
  // target 通过引用相等匹配；遍历所有函数的所有嵌套层级
  const parentFunc = findEnclosingFunction(target, allFunctions)
  if (!parentFunc) return []

  // 2. 添加函数参数
  for (const param of parentFunc.parameters) {
    variables.add(param.name)
  }

  // 3. 从函数体开始遍历，收集变量直到遇到 target
  walkBodyForScope(parentFunc.body, target, variables, new Set())

  return Array.from(variables)
}

/**
 * 在 AST 中按引用相等查找包含目标语句的函数定义
 */
function findEnclosingFunction(
  target: Statement,
  allFunctions: FunctionDef[],
): FunctionDef | null {
  for (const func of allFunctions) {
    if (containsStatement(func.body, target)) {
      return func
    }
  }
  return null
}

/**
 * 递归检查 body 数组（包括嵌套块）中是否包含目标语句（引用相等）
 */
function containsStatement(body: Statement[], target: Statement): boolean {
  for (const stmt of body) {
    if (stmt === target) return true
    if (stmt.kind === 'if') {
      if (containsStatement(stmt.thenBranch, target)) return true
      if (containsStatement(stmt.elseBranch, target)) return true
    } else if (stmt.kind === 'for' || stmt.kind === 'while' || stmt.kind === 'do') {
      if (containsStatement(stmt.body, target)) return true
    }
  }
  return false
}

/**
 * 遍历 body 数组，收集变量声明直到遇到 target 为止。
 *
 * @param body     当前层的语句数组
 * @param target   目标语句
 * @param out      收集到的变量名集合（会被修改）
 * @param visited  已访问的 body 引用集合，防止无限循环
 * @returns true 表示 target 已找到，调用者应停止遍历
 */
function walkBodyForScope(
  body: Statement[],
  target: Statement,
  out: Set<string>,
  visited: Set<Statement[]>,
): boolean {
  // 防止循环引用（理论上 AST 不会循环，但安全第一）
  if (visited.has(body)) return false
  visited.add(body)

  for (const stmt of body) {
    // 遇到目标语句 → 停止收集
    if (stmt === target) return true

    // 收集当前语句引入的变量
    collectVariablesFromStatement(stmt, out)

    // 递归进入嵌套块
    if (stmt.kind === 'if') {
      const foundInThen = walkBodyForScope(stmt.thenBranch, target, out, visited)
      if (foundInThen) return true
      const foundInElse = walkBodyForScope(stmt.elseBranch, target, out, visited)
      if (foundInElse) return true
    } else if (stmt.kind === 'for' || stmt.kind === 'while' || stmt.kind === 'do') {
      const found = walkBodyForScope(stmt.body, target, out, visited)
      if (found) return true
    }
  }

  // target 不在当前 body 中
  return false
}

/**
 * 从单条语句中提取它引入的变量名。
 * 仅处理"可声明新变量"的语句类型。
 */
function collectVariablesFromStatement(stmt: Statement, out: Set<string>): void {
  switch (stmt.kind) {
    case 'declare': {
      const names = splitDeclareNames((stmt as DeclareStatement).name)
      for (const name of names) {
        out.add(name)
      }
      break
    }
    case 'for': {
      // For 循环变量
      if (stmt.variable) out.add(stmt.variable)
      break
    }
    // assign / input 等不创建新变量（在 Flowgorithm 中只有 declare 和 for 循环变量创建新变量）
    // 注意：有些实现允许 "隐式声明"（在 assign 中首次使用即声明），这里保守处理，不纳入 assign 左值
    default:
      break
  }
}
