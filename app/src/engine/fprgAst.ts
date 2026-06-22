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

import { i18n } from '../i18n'
const t = i18n.global.t

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
  /** 初始化表达式（空字符串表示无初始值，使用默认值） */
  expression: string
  /** 变量标记：return = 函数返回值变量（不可删除），parameter = 函数形参 */
  tag?: 'return' | 'parameter'
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
  result?: string  // 可选：接收返回值的变量名
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

export interface BreakStatement {
  kind: 'break'
}

export interface ContinueStatement {
  kind: 'continue'
}

export interface ReturnStatement {
  kind: 'return'
  expression: string
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
  | BreakStatement
  | ContinueStatement
  | ReturnStatement
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

/**
 * 创建一个空白 Program（仅含 Main 函数、空 body）。
 * 用于新建文件或上次文件加载失败时的回退。
 */
export function createEmptyProgram(name?: string): Program {
  return {
    kind: 'program',
    attributes: {
      name: name ?? t('engine.label.untitled'),
      authors: '',
      about: '',
      saved: new Date().toISOString().split('T')[0],
    },
    functions: [
      {
        kind: 'function',
        name: 'Main',
        type: '',
        variable: '',
        parameters: [],
        body: [],
      },
    ],
  }
}

// ============================================================
// Function CRUD helpers
// ============================================================

/** 按名称查找函数定义 */
export function getFunctionByName(program: Program, name: string): FunctionDef | undefined {
  return program.functions.find((f) => f.name === name)
}

/** 创建一个空函数定义（默认返回类型 None，无参数，空 body） */
export function createEmptyFunction(name: string): FunctionDef {
  return {
    kind: 'function',
    name,
    type: 'None',
    variable: '',
    parameters: [],
    body: [],
  }
}

/** 添加一个函数到 program 末尾 */
export function addFunction(program: Program, func: FunctionDef): void {
  program.functions.push(func)
}

/** 删除指定名称的函数（Main 不可删除，返回 false 表示拒绝） */
export function deleteFunction(program: Program, name: string): boolean {
  if (name === 'Main') return false
  const idx = program.functions.findIndex((f) => f.name === name)
  if (idx === -1) return false
  program.functions.splice(idx, 1)
  return true
}

/** 重命名函数并更新所有 call 引用。返回 false 表示拒绝（名称重复或目标为 Main） */
export function renameFunction(program: Program, oldName: string, newName: string): boolean {
  if (oldName === 'Main' || newName === 'Main') return false
  if (oldName === newName) return true
  // 检查新名称是否已被占用
  if (program.functions.some((f) => f.name === newName)) return false

  const func = program.functions.find((f) => f.name === oldName)
  if (!func) return false

  func.name = newName

  // 更新所有函数中引用该函数的 call 表达式
  for (const f of program.functions) {
    updateCallReferences(f.body, oldName, newName)
  }

  return true
}

/** 递归更新语句体中所有 call 语句的引用函数名 */
function updateCallReferences(body: Statement[], oldName: string, newName: string): void {
  for (const stmt of body) {
    if (stmt.kind === 'call') {
      // call 表达式可能是 "oldName()" 或 "oldName(args)" 格式
      stmt.expression = stmt.expression.replace(
        new RegExp(`\\b${escapeRegExp(oldName)}\\s*\\(`),
        `${newName}(`,
      )
    } else if (stmt.kind === 'if') {
      updateCallReferences(stmt.thenBranch, oldName, newName)
      updateCallReferences(stmt.elseBranch, oldName, newName)
      // 条件表达式中也可能包含函数调用
      stmt.expression = stmt.expression.replace(
        new RegExp(`\\b${escapeRegExp(oldName)}\\s*\\(`),
        `${newName}(`,
      )
    } else if (stmt.kind === 'for' || stmt.kind === 'while' || stmt.kind === 'do') {
      updateCallReferences(stmt.body, oldName, newName)
      if (stmt.kind === 'while' || stmt.kind === 'do') {
        stmt.expression = stmt.expression.replace(
          new RegExp(`\\b${escapeRegExp(oldName)}\\s*\\(`),
          `${newName}(`,
        )
      }
      if (stmt.kind === 'for') {
        stmt.start = stmt.start.replace(
          new RegExp(`\\b${escapeRegExp(oldName)}\\s*\\(`),
          `${newName}(`,
        )
        stmt.end = stmt.end.replace(
          new RegExp(`\\b${escapeRegExp(oldName)}\\s*\\(`),
          `${newName}(`,
        )
        stmt.step = stmt.step.replace(
          new RegExp(`\\b${escapeRegExp(oldName)}\\s*\\(`),
          `${newName}(`,
        )
      }
    } else if (stmt.kind === 'assign' || stmt.kind === 'output' || stmt.kind === 'return') {
      stmt.expression = stmt.expression.replace(
        new RegExp(`\\b${escapeRegExp(oldName)}\\s*\\(`),
        `${newName}(`,
      )
    }
  }
}

/** 转义正则特殊字符 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 查找所有引用指定函数的 call 语句 */
export function findAllCallReferences(program: Program, funcName: string): Statement[] {
  const result: Statement[] = []
  for (const f of program.functions) {
    collectCallReferences(f.body, funcName, result)
  }
  return result
}

function collectCallReferences(body: Statement[], funcName: string, out: Statement[]): void {
  for (const stmt of body) {
    if (stmt.kind === 'call') {
      if (stmt.expression.includes(`${funcName}(`)) {
        out.push(stmt)
      }
    } else if (stmt.kind === 'if') {
      collectCallReferences(stmt.thenBranch, funcName, out)
      collectCallReferences(stmt.elseBranch, funcName, out)
    } else if (stmt.kind === 'for' || stmt.kind === 'while' || stmt.kind === 'do') {
      collectCallReferences(stmt.body, funcName, out)
    }
  }
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
    throw new Error(t('engine.error.invalidFprg'))
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
    case 'declare': {
      const tag = attr(el, 'tag') as DeclareStatement['tag'] | ''
      return {
        kind: 'declare',
        name: attr(el, 'name'),
        type: attr(el, 'type'),
        array: attr(el, 'array') === 'True',
        size: attr(el, 'size'),
        expression: attr(el, 'expression') || '',
        ...(tag ? { tag } : {}),
      }
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

    case 'call': {
      const resultVal = attr(el, 'result')
      return {
        kind: 'call',
        expression: attr(el, 'expression'),
        ...(resultVal ? { result: resultVal } : {}),
      }
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

    case 'break':
      return { kind: 'break' }

    case 'return':
      return {
        kind: 'return',
        expression: attr(el, 'expression'),
      }

    case 'continue':
      return { kind: 'continue' }

    case 'more':
      return { kind: 'more' }

    default:
      console.warn(`[fprg-ast] Unknown element <${tag}>, skipping`)
      return null
  }
}

// ============================================================
// Utility: split declare names
// ============================================================

/**
 * 拆分 declare 语句的 name 属性为独立变量名列表。
 * Flowgorithm 支持在一个 declare 中声明多个同类型变量，用逗号分隔。
 * 例如 name="N, i, isPrime" → ["N", "i", "isPrime"]
 */
export function splitDeclareNames(name: string): string[] {
  return name.split(',').map(s => s.trim()).filter(Boolean)
}

// ============================================================
// Utility: render a Statement to a human-readable label
// (用于 VueFlow 节点显示或其他调试场景)
// ============================================================

/**
 * 将一条 AST 语句转换为显示标签文本。
 * 内容为空时返回中文类型名作为占位提示。
 */
export function statementToLabel(stmt: Statement): string {
  switch (stmt.kind) {
    case 'declare': {
      if (!stmt.name) return t('engine.label.declare')
      const names = splitDeclareNames(stmt.name)
      const flowTypeCN = typeNameToCN(stmt.type)

      // 构建变量标签核心部分
      let core: string

      // 数组 + 数组字面量初始化 → 显示为 name = [elements]
      if (stmt.array && stmt.expression && /^\s*\[.*\]\s*$/.test(stmt.expression)) {
        const labeled = names.map((n) => `${n} = ${stmt.expression}`).join(', ')
        core = `${flowTypeCN} ${labeled}`
      }
      // 数组 + 标量/no 初始化 → 显示 [size]
      else if (stmt.array) {
        const arrSuffix = `[${stmt.size}]`
        const initPart = stmt.expression ? ` = ${stmt.expression}` : ''
        const labeled = names.map((n) => n + arrSuffix + initPart).join(', ')
        core = `${flowTypeCN} ${labeled}`
      }
      // 标量变量
      else {
        const initPart = stmt.expression ? ` = ${stmt.expression}` : ''
        const labeled = names.map((n) => n + initPart).join(', ')
        core = `${flowTypeCN} ${labeled}`
      }

      // 为带 tag 的变量添加标记前缀
      if (stmt.tag === 'parameter') {
        return `◎ ${core}`
      }
      return core
    }
    case 'assign':
      if (!stmt.variable) return t('engine.label.assign')
      return `${stmt.variable} = ${stmt.expression}`
    case 'input':
      if (!stmt.variable) return t('engine.label.input')
      return `${t('engine.label.input')} ${stmt.variable}`
    case 'output': {
      if (!stmt.expression) return t('engine.label.output')
      const expr = stmt.expression
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#13;/g, '')
        .replace(/&#10;/g, '')
      return `${t('engine.label.outputPrefix')}${expr}`
    }
    case 'call': {
      if (!stmt.expression) return t('engine.label.call')
      const callText = `${t('engine.label.callPrefix')}${stmt.expression}`
      if (stmt.result) {
        return `${stmt.result} = ${callText}`
      }
      return callText
    }
    case 'if':
      return stmt.expression || t('engine.label.if')
    case 'while':
      return stmt.expression || t('engine.label.while')
    case 'for': {
      if (!stmt.variable) return t('engine.label.for')
      let label = `${stmt.variable} = ${stmt.start}${t('engine.label.forTo')}${stmt.end}`
      if (stmt.step && stmt.step !== '1') label += `${t('engine.label.forStep')}${stmt.step}`
      return label
    }
    case 'do':
      return stmt.expression || t('engine.label.do')
    case 'more':
      return t('engine.label.ellipsis')
    case 'break':
      return t('engine.label.break')
    case 'continue':
      return t('engine.label.continue')
    case 'return':
      return stmt.expression || t('nodes.kind.return')
  }
}

/**
 * 判断语句是否为空（所有用户可编辑的字段均为空/默认值）
 */
export function isStatementEmpty(stmt: Statement): boolean {
  switch (stmt.kind) {
    case 'declare':
      return !stmt.name
    case 'assign':
      return !stmt.variable
    case 'input':
      return !stmt.variable
    case 'output':
      return !stmt.expression
    case 'call':
      return !stmt.expression
    case 'if':
      return !stmt.expression
    case 'while':
      return !stmt.expression
    case 'for':
      return !stmt.variable
    case 'do':
      return !stmt.expression
    case 'more':
      return false
    case 'break':
      return false
    case 'continue':
      return false
    case 'return':
      return !stmt.expression
  }
}

// ============================================================
// Type name localization (English → Chinese)
// ============================================================

const TYPE_NAME_CN: Record<string, string> = {
  'Integer': t('nodes.typeShort.Integer'),
  'Real':    t('nodes.typeShort.Real'),
  'Boolean': t('nodes.typeShort.Boolean'),
  'String':  t('nodes.typeShort.String'),
}

export function typeNameToCN(en: string): string {
  return TYPE_NAME_CN[en] ?? en
}

// ============================================================
// AST Mutation: create default Statement
// ============================================================

/**
 * 根据语句类型创建带默认值的 Statement 对象
 */
export function createDefaultStatement(kind: Statement['kind']): Statement {
  switch (kind) {
    case 'declare':
      return { kind: 'declare', name: '', type: 'Integer', array: false, size: '', expression: '' }
    case 'assign':
      return { kind: 'assign', variable: '', expression: '' }
    case 'input':
      return { kind: 'input', variable: '' }
    case 'output':
      return { kind: 'output', expression: '', newline: true }
    case 'call':
      return { kind: 'call', expression: '', result: '' }
    case 'if':
      return { kind: 'if', expression: '', thenBranch: [], elseBranch: [] }
    case 'while':
      return { kind: 'while', expression: '', body: [] }
    case 'for':
      return { kind: 'for', variable: '', start: '', end: '', step: '1', body: [] }
    case 'do':
      return { kind: 'do', expression: '', body: [] }
    case 'more':
      return { kind: 'more' }
    case 'break':
      return { kind: 'break' }
    case 'continue':
      return { kind: 'continue' }
    case 'return':
      return { kind: 'return', expression: '' }
  }
}

// ============================================================
// AST Search: find statement location
// ============================================================

/** 语句在 AST 中的位置 */
export interface StmtLocation {
  /** 包含该语句的数组引用 */
  body: Statement[]
  /** 在该数组中的索引 */
  index: number
  /** 所属函数 */
  parentFunc: FunctionDef
}

/**
 * 在 AST 中递归搜索指定 Statement 的位置
 */
export function findStatementLocation(program: Program, stmt: Statement): StmtLocation | null {
  for (const func of program.functions) {
    const loc = searchInBody(func.body, stmt, func)
    if (loc) return loc
  }
  return null
}

function searchInBody(body: Statement[], target: Statement, parentFunc: FunctionDef): StmtLocation | null {
  for (let i = 0; i < body.length; i++) {
    if (body[i] === target) {
      return { body, index: i, parentFunc }
    }
    // 递归搜索嵌套结构
    const s = body[i]
    if (s.kind === 'if') {
      const thenLoc = searchInBody(s.thenBranch, target, parentFunc)
      if (thenLoc) return thenLoc
      const elseLoc = searchInBody(s.elseBranch, target, parentFunc)
      if (elseLoc) return elseLoc
    } else if (s.kind === 'for' || s.kind === 'while' || s.kind === 'do') {
      const bodyLoc = searchInBody(s.body, target, parentFunc)
      if (bodyLoc) return bodyLoc
    }
  }
  return null
}

// ============================================================
// AST Serialization: Program → .fprg XML
// ============================================================

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function statementsToXml(statements: Statement[], indent: string): string {
  return statements.map(s => stmtToXml(s, indent)).join('\n')
}

function stmtToXml(stmt: Statement, indent: string): string {
  const i2 = indent + '    '

  switch (stmt.kind) {
    case 'declare': {
      const exprAttr = stmt.expression ? ` expression="${escapeAttr(stmt.expression)}"` : ''
      const tagAttr = stmt.tag ? ` tag="${stmt.tag}"` : ''
      return `${indent}<declare name="${escapeAttr(stmt.name)}" type="${escapeAttr(stmt.type)}" array="${stmt.array ? 'True' : 'False'}" size="${escapeAttr(stmt.size)}"${exprAttr}${tagAttr}/>`
    }

    case 'assign':
      return `${indent}<assign variable="${escapeAttr(stmt.variable)}" expression="${escapeAttr(stmt.expression)}"/>`

    case 'input':
      return `${indent}<input variable="${escapeAttr(stmt.variable)}"/>`

    case 'output':
      return `${indent}<output expression="${escapeAttr(stmt.expression)}" newline="${stmt.newline ? 'True' : 'False'}"/>`

    case 'call': {
      const resultAttr = stmt.result ? ` result="${escapeAttr(stmt.result)}"` : ''
      return `${indent}<call expression="${escapeAttr(stmt.expression)}"${resultAttr}/>`
    }

    case 'if': {
      const thenXml = stmt.thenBranch.length > 0
        ? `\n${statementsToXml(stmt.thenBranch, i2 + '    ')}\n${i2}`
        : ''
      const elseXml = stmt.elseBranch.length > 0
        ? `\n${statementsToXml(stmt.elseBranch, i2 + '    ')}\n${i2}`
        : ''
      return `${indent}<if expression="${escapeAttr(stmt.expression)}">\n`
        + `${i2}<then>${thenXml}</then>\n`
        + `${i2}<else>${elseXml}</else>\n`
        + `${indent}</if>`
    }

    case 'while':
      if (stmt.body.length === 0) {
        return `${indent}<while expression="${escapeAttr(stmt.expression)}"/>`
      }
      return `${indent}<while expression="${escapeAttr(stmt.expression)}">\n`
        + `${statementsToXml(stmt.body, i2)}\n`
        + `${indent}</while>`

    case 'for':
      if (stmt.body.length === 0) {
        return `${indent}<for variable="${escapeAttr(stmt.variable)}" start="${escapeAttr(stmt.start)}" end="${escapeAttr(stmt.end)}" step="${escapeAttr(stmt.step)}"/>`
      }
      return `${indent}<for variable="${escapeAttr(stmt.variable)}" start="${escapeAttr(stmt.start)}" end="${escapeAttr(stmt.end)}" step="${escapeAttr(stmt.step)}">\n`
        + `${statementsToXml(stmt.body, i2)}\n`
        + `${indent}</for>`

    case 'do':
      if (stmt.body.length === 0) {
        return `${indent}<do expression="${escapeAttr(stmt.expression)}"/>`
      }
      return `${indent}<do expression="${escapeAttr(stmt.expression)}">\n`
        + `${statementsToXml(stmt.body, i2)}\n`
        + `${indent}</do>`

    case 'break':
      return `${indent}<break/>`
    case 'continue':
      return `${indent}<continue/>`
    case 'return':
      return `${indent}<return expression="${escapeAttr(stmt.expression)}"/>`
    case 'more':
      return `${indent}<more/>`
  }
}

/**
 * 将 AST Program 序列化为 .fprg XML 字符串
 */
export function astToFprgXml(program: Program): string {
  const today = new Date().toISOString().split('T')[0]

  let xml = '<?xml version="1.0"?>\n'
  xml += '<flowgorithm fileversion="4.2">\n'

  // Attributes
  xml += '    <attributes>\n'
  xml += `        <attribute name="name" value="${escapeAttr(program.attributes.name)}"/>\n`
  xml += `        <attribute name="authors" value="${escapeAttr(program.attributes.authors)}"/>\n`
  xml += `        <attribute name="about" value="${escapeAttr(program.attributes.about)}"/>\n`
  xml += `        <attribute name="saved" value="${escapeAttr(program.attributes.saved || today)}"/>\n`
  xml += '    </attributes>\n'

  // Functions
  for (const func of program.functions) {
    xml += `    <function name="${escapeAttr(func.name)}" type="${escapeAttr(func.type)}" variable="${escapeAttr(func.variable)}">\n`

    // Parameters
    if (func.parameters.length > 0) {
      xml += '        <parameters>\n'
      for (const p of func.parameters) {
        xml += `            <parameter name="${escapeAttr(p.name)}" type="${escapeAttr(p.type)}" array="${p.array ? 'True' : 'False'}"/>\n`
      }
      xml += '        </parameters>\n'
    } else {
      xml += '        <parameters/>\n'
    }

    // Body
    xml += '        <body>\n'
    for (const stmt of func.body) {
      xml += stmtToXml(stmt, '            ') + '\n'
    }
    xml += '        </body>\n'

    xml += '    </function>\n'
  }

  xml += '</flowgorithm>\n'
  return xml
}
