// ============================================================
// fprg-ast.ts — Flowgorithm .fprg XML → AST 解析器
//
// 将 fprg XML 转换为与框架无关的抽象语法树（AST），
// 便于不同渲染目标（SVG / VueFlow / Canvas）共用同一份解析逻辑。
//
// 支持全部 fprg 元素：
//   Leaf:    declare, assign, input, output, call, more
//   Branch:  if (then/else)
//   Loop:    while, for, do
// ============================================================

// ============================================================
// Types
// ============================================================

/** 程序元信息 */
export interface ProgramAttributes {
  name: string
  authors: string
  about: string
  saved: string
}

/** 函数参数 */
export interface Parameter {
  name: string
  type: string
  array: boolean
}

// ----- Statement discriminated union -----

export interface DeclareStatement {
  kind: 'declare'
  name: string
  type: string
  array: boolean
  size: string
}

export interface AssignStatement {
  kind: 'assign'
  variable: string
  expression: string
}

export interface InputStatement {
  kind: 'input'
  variable: string
}

export interface OutputStatement {
  kind: 'output'
  expression: string
  newline: boolean
}

export interface CallStatement {
  kind: 'call'
  expression: string
}

export interface IfStatement {
  kind: 'if'
  expression: string
  thenBranch: Statement[]
  elseBranch: Statement[]
}

export interface WhileStatement {
  kind: 'while'
  expression: string
  body: Statement[]
}

export interface ForStatement {
  kind: 'for'
  variable: string
  start: string
  end: string
  step: string
  body: Statement[]
}

export interface DoStatement {
  kind: 'do'
  expression: string
  body: Statement[]
}

export interface MoreStatement {
  kind: 'more'
}

/** 所有语句类型的联合，_nodeId 由消费者（VueFlow）在运行时挂载 */
export type Statement = (
  | DeclareStatement
  | AssignStatement
  | InputStatement
  | OutputStatement
  | CallStatement
  | IfStatement
  | WhileStatement
  | ForStatement
  | DoStatement
  | MoreStatement
) & { _nodeId?: string }

/** 函数定义 */
export interface FunctionDef {
  kind: 'function'
  name: string
  type: string
  variable: string
  parameters: Parameter[]
  body: Statement[]
}

/** AST 根节点 */
export interface Program {
  kind: 'program'
  attributes: ProgramAttributes
  functions: FunctionDef[]
}

// ============================================================
// Parser
// ============================================================

/**
 * 解析 fprg XML 字符串，返回抽象语法树
 */
export function parseFprgToAst(xml: string): Program {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  const root = doc.documentElement

  if (!root || root.tagName !== 'flowgorithm') {
    throw new Error('Invalid fprg file: missing <flowgorithm> root element')
  }

  return {
    kind: 'program',
    attributes: parseAttributes(root),
    functions: parseFunctions(root),
  }
}

// ----- Internal parsers -----

function attr(el: Element, name: string): string {
  return el.getAttribute(name) ?? ''
}

function parseAttributes(root: Element): ProgramAttributes {
  const getAttrVal = (name: string) =>
    root.querySelector(`attributes > attribute[name="${name}"]`)?.getAttribute('value') ?? ''

  return {
    name: getAttrVal('name'),
    authors: getAttrVal('authors'),
    about: getAttrVal('about'),
    saved: getAttrVal('saved'),
  }
}

function parseFunctions(root: Element): FunctionDef[] {
  const funcs: FunctionDef[] = []
  root.querySelectorAll(':scope > function').forEach((el) => {
    funcs.push(parseFunction(el))
  })
  return funcs
}

function parseFunction(el: Element): FunctionDef {
  const params: Parameter[] = []
  el.querySelectorAll(':scope > parameters > parameter').forEach((p) => {
    params.push({
      name: attr(p, 'name'),
      type: attr(p, 'type'),
      array: attr(p, 'array') === 'True',
    })
  })

  const bodyEl = el.querySelector(':scope > body')
  const body = bodyEl ? parseBody(bodyEl) : []

  return {
    kind: 'function',
    name: attr(el, 'name'),
    type: attr(el, 'type'),
    variable: attr(el, 'variable'),
    parameters: params,
    body,
  }
}

/**
 * 递归解析 body 内的子元素列表
 */
function parseBody(bodyEl: Element): Statement[] {
  const statements: Statement[] = []

  for (let i = 0; i < bodyEl.children.length; i++) {
    const el = bodyEl.children[i]
    const stmt = parseStatement(el)
    if (stmt) {
      statements.push(stmt)
    }
  }

  return statements
}

/**
 * 根据元素标签名分发到对应的解析函数
 */
function parseStatement(el: Element): Statement | null {
  const tag = el.tagName.toLowerCase()

  switch (tag) {
    case 'declare':
      return {
        kind: 'declare',
        name: attr(el, 'name'),
        type: attr(el, 'type'),
        array: attr(el, 'array') === 'True',
        size: attr(el, 'size'),
      }

    case 'assign':
      return {
        kind: 'assign',
        variable: attr(el, 'variable'),
        expression: attr(el, 'expression'),
      }

    case 'input':
      return {
        kind: 'input',
        variable: attr(el, 'variable'),
      }

    case 'output':
      return {
        kind: 'output',
        expression: attr(el, 'expression'),
        newline: attr(el, 'newline') !== 'False',
      }

    case 'call':
      return {
        kind: 'call',
        expression: attr(el, 'expression'),
      }

    case 'if': {
      const thenEl = el.querySelector(':scope > then')
      const elseEl = el.querySelector(':scope > else')
      return {
        kind: 'if',
        expression: attr(el, 'expression'),
        thenBranch: thenEl ? parseBody(thenEl) : [],
        elseBranch: elseEl ? parseBody(elseEl) : [],
      }
    }

    case 'while':
      return {
        kind: 'while',
        expression: attr(el, 'expression'),
        body: parseBody(el),
      }

    case 'for':
      return {
        kind: 'for',
        variable: attr(el, 'variable'),
        start: attr(el, 'start'),
        end: attr(el, 'end'),
        step: attr(el, 'step'),
        body: parseBody(el),
      }

    case 'do':
      return {
        kind: 'do',
        expression: attr(el, 'expression'),
        body: parseBody(el),
      }

    case 'more':
      return { kind: 'more' }

    default:
      console.warn(`[fprg-ast] Unknown element <${tag}>, skipping`)
      return null
  }
}

// ============================================================
// Utility: render a Statement to a human-readable label
// (用于 VueFlow 节点显示或其他调试场景)
// ============================================================

/**
 * 将一条 AST 语句转换为显示标签文本
 */
export function statementToLabel(stmt: Statement): string {
  switch (stmt.kind) {
    case 'declare': {
      const arr = stmt.array ? `[${stmt.size}]` : ''
      return `${typeNameToCN(stmt.type)} ${stmt.name}${arr}`
    }
    case 'assign':
      return `${stmt.variable} = ${stmt.expression}`
    case 'input':
      return `输入 ${stmt.variable}`
    case 'output': {
      const expr = stmt.expression
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#13;/g, '')
        .replace(/&#10;/g, '')
      return `输出 ${expr}`
    }
    case 'call':
      return `调用 ${stmt.expression}`
    case 'if':
      return stmt.expression
    case 'while':
      return stmt.expression
    case 'for': {
      let label = `${stmt.variable} = ${stmt.start} 到 ${stmt.end}`
      if (stmt.step && stmt.step !== '1') label += ` 步长 ${stmt.step}`
      return label
    }
    case 'do':
      return stmt.expression
    case 'more':
      return '...'
  }
}

// ============================================================
// Type name localization (English → Chinese)
// ============================================================

const TYPE_NAME_CN: Record<string, string> = {
  'Integer': '整数',
  'Real':    '实数',
  'Boolean': '布尔',
  'String':  '字符串',
}

export function typeNameToCN(en: string): string {
  return TYPE_NAME_CN[en] ?? en
}
