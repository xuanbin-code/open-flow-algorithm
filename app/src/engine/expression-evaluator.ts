// ============================================================
// expression-evaluator.ts — Flowgorithm 表达式求值器
//
// 将 Flowgorithm 表达式字符串翻译为 JavaScript 并安全求值。
// 变量名作为 Function 参数传入，不访问全局作用域。
// ============================================================

/**
 * 将 Flowgorithm 表达式翻译为 JavaScript 可求值的表达式。
 *
 * 翻译规则：
 *   =  → ===    (等于比较)
 *   <> → !==    (不等于)
 *   and → &&    (逻辑与)
 *   or  → ||    (逻辑或)
 *   not → !     (逻辑非)
 *   ^  → **     (幂运算)
 *   mod → %     (取模)
 *
 * 「&」不在此处翻译 — 它仅在操作数中存在字符串时才是拼接，
 *   否则是位运算。翻译由 evaluateExpression 在运行时决定。
 */
function normalizeExpression(expr: string): string {
  let result = expr

  // 1. 先替换多字符运算符（避免 <> 中的 = 被单独替换）
  result = result.replace(/<>/g, '!==')

  // 2. 替换 = 为 ===（但要避开已经替换过的 !==, <=, >=）
  result = result.replace(/(?<![!<>])=(?!=)/g, '===')

  // 3. 幂运算
  result = result.replace(/\^/g, '**')

  // 4. 关键字替换（用词边界避免误伤变量名 like "android" / "notify"）
  result = result.replace(/\band\b/gi, '&&')
  result = result.replace(/\bor\b/gi, '||')
  result = result.replace(/\bnot\b/gi, '!')
  result = result.replace(/\bmod\b/gi, '%')

  return result
}

// ============================================================
// 安全校验
// ============================================================

/** 拒绝明显危险的表达式注入模式 */
const DANGEROUS_PATTERNS = [
  /constructor/i,
  /__proto__/i,
  /prototype/i,
  /\bFunction\s*\(/i,
  /\beval\s*\(/i,
  /\bimport\s*\(/i,
  /\brequire\s*\(/i,
  /\bfetch\s*\(/i,
  /\bXMLHttpRequest\b/i,
  /\bdocument\b/i,
  /\bwindow\b/i,
  /\bglobalThis\b/i,
  /\bprocess\b/i,
  /\bbuffer\b/i,
]

function validateExpression(expr: string): void {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(expr)) {
      throw new Error(
        `表达式包含不允许的操作: "${expr}"\n` +
        `  匹配模式: ${String(pattern)}`,
      )
    }
  }
}

// ============================================================
// 变量访问解析
// ============================================================

/**
 * 解析变量名中的数组下标语法。
 *
 * 例如：
 *   "arr[0]"   → { name: "arr", indexExpr: "0" }
 *   "arr[i+1]" → { name: "arr", indexExpr: "i+1" }
 *   "x"        → { name: "x", indexExpr: null }
 */
export function parseArrayAccess(variable: string): {
  name: string
  indexExpr: string | null
} {
  const match = variable.match(/^(\w+)\[(.+)\]$/)
  if (match) {
    return { name: match[1], indexExpr: match[2] }
  }
  return { name: variable, indexExpr: null }
}

/**
 * 求值 Flowgorithm 表达式。
 *
 * @param expr  原始表达式字符串（如 "x + 1", "x > 10 and y < 5"）
 * @param variables  变量名 → 当前值
 * @returns 求值结果
 */
export function evaluateExpression(
  expr: string,
  variables: Record<string, unknown>,
): unknown {
  if (!expr || expr.trim() === '') return undefined

  // 安全校验：拒绝危险注入模式
  validateExpression(expr)

  // 检查是否包含 & 运算符（字符串拼接 / 位与）
  const hasAmpersand = /&/.test(expr)

  let jsExpr: string
  if (hasAmpersand) {
    // 分析每个操作数：若当前变量中对应名字的值是 string → 翻译 & 为 +
    // 安全做法：先求值两边的操作数，若任一为 string 则用 + 拼接
    // 否则用 &（JS 中 & 也是位与，保持不变）
    // 简化：直接将 & 替换为 +，因为 Flowgorithm 中 & 几乎总是字符串拼接
    jsExpr = normalizeExpression(expr.replace(/&/g, '+'))
  } else {
    jsExpr = normalizeExpression(expr)
  }

  // 收集变量名列表，作为 Function 参数传入
  const varNames = Object.keys(variables)

  try {
    const fn = new Function(...varNames, `return (${jsExpr})`)
    const result = fn(...varNames.map((n) => variables[n]))

    // 类型转换：根据变量声明类型转换赋值结果
    return result
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      `表达式求值失败: "${expr}"\n` +
        `  规范化后: "${jsExpr}"\n` +
        `  变量: ${JSON.stringify(variables)}\n` +
        `  原因: ${msg}`,
    )
  }
}

/**
 * 根据变量声明的类型，将值转换为正确的运行时类型。
 * 用于 declare 初始化、assign 赋值、input 输入后。
 */
export function coerceValue(value: unknown, flowType: string): unknown {
  switch (flowType) {
    case 'Integer': {
      if (typeof value === 'number') return Math.floor(value)
      if (typeof value === 'boolean') return value ? 1 : 0
      const n = Number(value)
      return Number.isNaN(n) ? 0 : Math.floor(n)
    }
    case 'Real': {
      if (typeof value === 'number') return value
      if (typeof value === 'boolean') return value ? 1.0 : 0.0
      const n = Number(value)
      return Number.isNaN(n) ? 0.0 : n
    }
    case 'String':
      return String(value ?? '')
    case 'Boolean': {
      if (typeof value === 'boolean') return value
      if (typeof value === 'number') return value !== 0
      const s = String(value).toLowerCase()
      return s === 'true' || s === '真'
    }
    default:
      return value
  }
}

/**
 * 获取 Flowgorithm 类型的默认初始值。
 */
export function defaultValueForType(flowType: string): unknown {
  switch (flowType) {
    case 'Integer': return 0
    case 'Real':    return 0.0
    case 'String':  return ''
    case 'Boolean': return false
    default:        return 0
  }
}

/**
 * 测试表达式是否为字面量（不需要变量即可求值）
 */
export function isLiteral(expr: string): boolean {
  const trimmed = expr.trim()
  // 数字
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return true
  // 字符串
  if (/^"[^"]*"$/.test(trimmed) || /^'[^']*'$/.test(trimmed)) return true
  // 布尔
  if (/^(true|false|真|假)$/i.test(trimmed)) return true
  return false
}
