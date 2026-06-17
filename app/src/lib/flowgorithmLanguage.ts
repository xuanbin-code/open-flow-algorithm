// ============================================================
// flowgorithm-language.ts — CodeMirror 6 language definition
//
// 为 Flowgorithm 伪代码表达式提供：
//   1. 语法高亮（StreamLanguage tokenizer）
//   2. 编辑器主题（引用项目 CSS 变量，暗/亮自动适配）
//   3. 自动补全（关键字、作用域变量、函数名、Math 内置）
// ============================================================

import {
  StreamLanguage,
  StringStream,
} from '@codemirror/language'
import { HighlightStyle } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import {
  type CompletionSource,
  type CompletionContext,
  type Completion,
} from '@codemirror/autocomplete'
import { tags } from '@lezer/highlight'

// ============================================================
// Types
// ============================================================

export interface CompletionContextData {
  /** 当前作用域内的变量名列表 */
  variables: string[]
  /** 用户自定义函数列表 */
  functions: { name: string; type: string; parameters: { name: string; type: string }[] }[]
  /** 当前编辑的语句类型（用于调整补全优先级） */
  statementKind: string
}

// ============================================================
// Token categories
// ============================================================

const TOKEN_KEYWORD = 'keyword'
const TOKEN_BOOLEAN = 'boolean'
const TOKEN_NUMBER = 'number'
const TOKEN_STRING = 'string'
const TOKEN_OPERATOR = 'operator'
const TOKEN_FUNCTION_NAME = 'functionName'
const TOKEN_VARIABLE_NAME = 'variableName'
const TOKEN_BRACKET = 'bracket'
const TOKEN_SEPARATOR = 'separator'
const TOKEN_INVALID = 'invalid'

// ============================================================
// Keywords and booleans (case-insensitive)
// ============================================================

const KEYWORDS = new Set(['and', 'or', 'not', 'mod'])
const BOOLEANS = new Set(['true', 'false', '真', '假']) // 真 / 假

// ============================================================
// Operator definition order matters: multi-char before single-char
// ============================================================

const OPERATORS_MULTI = ['<>', '<=', '>=']
const OPERATORS_SINGLE = ['+', '-', '*', '/', '^', '=', '<', '>', '&']
const BRACKETS = new Set(['(', ')', '[', ']'])
const SEPARATORS = new Set([',', '.'])

// ============================================================
// StreamLanguage tokenizer
// ============================================================

function tokenizer(stream: StringStream): string | null {
  // Skip whitespace
  if (stream.eatSpace()) return null

  const ch = stream.peek()
  if (ch === undefined) return null

  // Line comment (future-proof)
  if (ch === '/' && stream.peek() === '/') {
    stream.skipToEnd()
    return null // treat comment as inert
  }

  // Number: integer or decimal
  if (ch >= '0' && ch <= '9') {
    return readNumber(stream)
  }
  // Number starting with dot (e.g. .5)
  if (ch === '.') {
    const nextCh = stream.string[stream.pos + 1]
    if (nextCh >= '0' && nextCh <= '9') {
      // It's a decimal number
      stream.next() // consume '.'
      stream.eatWhile((c: string) => c >= '0' && c <= '9')
      return TOKEN_NUMBER
    }
    // Otherwise treat as separator (property access dot)
    stream.next()
    return TOKEN_SEPARATOR
  }

  // String literal (double-quoted or single-quoted)
  if (ch === '"' || ch === "'") {
    return readString(stream, ch)
  }

  // Multi-character operators
  for (const op of OPERATORS_MULTI) {
    if (stream.match(op, false)) {
      stream.match(op, true)
      return TOKEN_OPERATOR
    }
  }

  // Single-character operators
  const remaining = stream.string.slice(stream.pos)
  for (const op of OPERATORS_SINGLE) {
    if (remaining.startsWith(op)) {
      stream.pos += op.length
      return TOKEN_OPERATOR
    }
  }

  // Brackets
  if (BRACKETS.has(ch)) {
    stream.next()
    return TOKEN_BRACKET
  }

  // Separators
  if (SEPARATORS.has(ch)) {
    stream.next()
    return TOKEN_SEPARATOR
  }

  // Identifier or keyword
  if (isIdentStart(ch)) {
    return readIdent(stream)
  }

  // Unknown — consume and mark as invalid
  stream.next()
  return TOKEN_INVALID
}

function readNumber(stream: StringStream): string {
  stream.eatWhile((c: string) => c >= '0' && c <= '9')
  // Fractional part
  if (stream.peek() === '.' && stream.string[stream.pos + 1] >= '0' && stream.string[stream.pos + 1] <= '9') {
    stream.next() // consume '.'
    stream.eatWhile((c: string) => c >= '0' && c <= '9')
  }
  return TOKEN_NUMBER
}

function readString(stream: StringStream, quote: string): string {
  stream.next() // consume opening quote
  let escaped = false
  while (!stream.eol()) {
    const c = stream.next()
    if (escaped) {
      escaped = false
      continue
    }
    if (c === '\\') {
      escaped = true
      continue
    }
    if (c === quote) {
      return TOKEN_STRING
    }
  }
  // Unterminated string
  return TOKEN_INVALID
}

function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch > '\x7f'
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || (ch >= '0' && ch <= '9')
}

function readIdent(stream: StringStream): string {
  const start = stream.pos
  stream.eatWhile(isIdentPart)
  const word = stream.string.slice(start, stream.pos)
  const lowered = word.toLowerCase()

  // Check if keyword
  if (KEYWORDS.has(lowered)) return TOKEN_KEYWORD

  // Check if boolean literal
  if (BOOLEANS.has(lowered)) return TOKEN_BOOLEAN

  // Peek ahead: if followed by '(', it's a function name
  // (but not if preceded by '.' — that would be a method name)
  let after = stream.pos
  while (after < stream.string.length && stream.string[after] === ' ') after++
  if (after < stream.string.length && stream.string[after] === '(') {
    return TOKEN_FUNCTION_NAME
  }

  return TOKEN_VARIABLE_NAME
}

// ============================================================
// Exported language
// ============================================================

export const flowgorithmLanguage = StreamLanguage.define({
  startState: () => ({}),
  token: tokenizer,
  languageData: {
    closeBrackets: { brackets: ['(', '[', '"', "'"] },
    commentTokens: { line: '//' },
  },
})

// ============================================================
// Highlight style — map token tags to CSS classes
// ============================================================

export const flowgorithmHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, class: 'cm-keyword' },
  { tag: tags.bool, class: 'cm-boolean' },
  { tag: tags.number, class: 'cm-number' },
  { tag: tags.string, class: 'cm-string' },
  { tag: tags.operator, class: 'cm-operator' },
  { tag: tags.function(tags.variableName), class: 'cm-functionName' },
  { tag: tags.variableName, class: 'cm-variableName' },
  { tag: tags.propertyName, class: 'cm-property' },
  { tag: tags.paren, class: 'cm-bracket' },
  { tag: tags.separator, class: 'cm-separator' },
  { tag: tags.invalid, class: 'cm-invalid' },
])

// ============================================================
// EditorView theme — all colors reference project CSS variables
// ============================================================

export const flowgorithmTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--bg-hover)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      borderRadius: '4px',
      border: '1px solid var(--dialog-border)',
      minHeight: '28px',
    },
    '&.cm-focused': {
      outline: 'none',
      borderColor: 'var(--accent)',
    },
    '&.cm-editor .cm-scroller': {
      fontFamily: 'var(--font-mono)',
      lineHeight: '1.6',
    },
    // Cursor
    '.cm-cursor': {
      borderLeftColor: 'var(--accent)',
    },
    // Selection
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 25%, transparent)',
    },
    // Active line highlight
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
    },
    // Gutter (hidden — no line numbers)
    '.cm-gutters': {
      display: 'none',
    },
    // Token styles
    '.cm-keyword': {
      color: 'var(--accent)',
      fontWeight: '600',
    },
    '.cm-boolean': {
      color: 'var(--accent-orange)',
      fontWeight: '600',
    },
    '.cm-number': {
      color: 'var(--accent-green)',
    },
    '.cm-string': {
      color: 'var(--accent-orange)',
    },
    '.cm-operator': {
      color: 'var(--text-muted)',
    },
    '.cm-functionName': {
      color: 'var(--accent)',
      fontStyle: 'italic',
    },
    '.cm-variableName': {
      color: 'var(--text-primary)',
    },
    '.cm-property': {
      color: 'var(--accent)',
    },
    '.cm-bracket': {
      color: 'var(--text-muted-2)',
    },
    '.cm-separator': {
      color: 'var(--text-muted)',
    },
    '.cm-invalid': {
      color: 'var(--accent-red)',
      textDecoration: 'underline wavy var(--accent-red)',
    },
    // Matching bracket
    '.cm-matchingBracket': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)',
      outline: '1px solid var(--accent)',
    },
    // Autocomplete tooltip
    '.cm-tooltip': {
      backgroundColor: 'var(--popover)',
      border: '1px solid var(--border)',
      color: 'var(--popover-foreground)',
      borderRadius: '6px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      fontSize: '12px',
      fontFamily: 'var(--font-sans)',
    },
    '.cm-tooltip-autocomplete ul li': {
      padding: '4px 8px',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
      color: 'var(--accent-foreground)',
    },
    '.cm-completionDetail': {
      color: 'var(--text-muted)',
      fontStyle: 'italic',
      fontSize: '11px',
    },
    '.cm-completionIcon': {
      opacity: '0.7',
      width: '14px',
      textAlign: 'center',
      marginRight: '4px',
    },
  },
  { dark: false }, // dynamic theme via CSS variables
)

// ============================================================
// Autocomplete source
// ============================================================

/** Built-in Math methods with signatures */
const BUILTIN_MATH: Completion[] = [
  { label: 'Math.abs', type: 'function', detail: '(n) → number', boost: 1 },
  { label: 'Math.sqrt', type: 'function', detail: '(n) → number', boost: 1 },
  { label: 'Math.pow', type: 'function', detail: '(base, exp) → number', boost: 1 },
  { label: 'Math.floor', type: 'function', detail: '(n) → integer', boost: 1 },
  { label: 'Math.ceil', type: 'function', detail: '(n) → integer', boost: 1 },
  { label: 'Math.round', type: 'function', detail: '(n) → integer', boost: 1 },
  { label: 'Math.trunc', type: 'function', detail: '(n) → integer', boost: 0.5 },
  { label: 'Math.sign', type: 'function', detail: '(n) → -1|0|1', boost: 0.5 },
  { label: 'Math.random', type: 'function', detail: '() → 0..1', boost: 1 },
  { label: 'Math.max', type: 'function', detail: '(a, b, ...) → number', boost: 1 },
  { label: 'Math.min', type: 'function', detail: '(a, b, ...) → number', boost: 1 },
  { label: 'Math.sin', type: 'function', detail: '(rad) → number', boost: 0.5 },
  { label: 'Math.cos', type: 'function', detail: '(rad) → number', boost: 0.5 },
  { label: 'Math.tan', type: 'function', detail: '(rad) → number', boost: 0.5 },
  { label: 'Math.asin', type: 'function', detail: '(n) → rad', boost: 0.3 },
  { label: 'Math.acos', type: 'function', detail: '(n) → rad', boost: 0.3 },
  { label: 'Math.atan', type: 'function', detail: '(n) → rad', boost: 0.3 },
  { label: 'Math.log', type: 'function', detail: '(n) → number', boost: 0.3 },
  { label: 'Math.exp', type: 'function', detail: '(n) → number', boost: 0.3 },
  { label: 'Math.PI', type: 'constant', detail: '3.14159...', boost: 1 },
  { label: 'Math.E', type: 'constant', detail: '2.71828...', boost: 0.5 },
]

/** Keyword / boolean / operator completions */
function keywordCompletions(statementKind: string): Completion[] {
  const boost = statementKind === 'if' || statementKind === 'while' || statementKind === 'do' ? 3 : 1.5
  return [
    { label: 'and', type: 'keyword', detail: 'logical AND', boost },
    { label: 'or', type: 'keyword', detail: 'logical OR', boost },
    { label: 'not', type: 'keyword', detail: 'logical NOT', boost },
    { label: 'mod', type: 'keyword', detail: 'modulo (remainder)', boost: 1 },
    { label: 'true', type: 'constant', detail: 'boolean', boost },
    { label: 'false', type: 'constant', detail: 'boolean', boost },
  ]
}

/** Variable completions from scope */
function variableCompletions(variables: string[]): Completion[] {
  return variables.map((v) => ({
    label: v,
    type: 'variable' as const,
    detail: 'variable',
    boost: 2,
  }))
}

/** User-defined function completions */
function functionCompletions(
  functions: { name: string; type: string; parameters: { name: string; type: string }[] }[],
): Completion[] {
  return functions.map((f) => {
    const paramStr = f.parameters.map((p) => `${p.name}: ${p.type}`).join(', ')
    const returnStr = f.type && f.type !== 'None' ? ` → ${f.type}` : ''
    return {
      label: f.name,
      type: 'function' as const,
      detail: `(${paramStr})${returnStr}`,
      boost: 3,
    }
  })
}

/**
 * Create a CM6 CompletionSource from context data.
 *
 * Returns `null` when no context is available (no completions).
 */
export function createFlowgorithmCompletions(
  context: CompletionContextData | null,
): CompletionSource {
  if (!context) {
    // Return a source that provides nothing
    return () => null
  }

  return (cmCtx: CompletionContext) => {
    const word = cmCtx.matchBefore(/\w*/)

    // If after '.', offer Math completions
    if (word && word.from > 0) {
      const beforeDot = cmCtx.state.doc.sliceString(Math.max(0, word.from - 6), word.from)
      if (beforeDot === 'Math.' || /\.$/.test(beforeDot)) {
        // User typed "Math." or some prefix after dot
        const afterDot = word.text.toLowerCase()
        const filtered = BUILTIN_MATH.filter((c) =>
          c.label.toLowerCase().startsWith('math.' + afterDot),
        )
        if (filtered.length > 0) {
          return {
            from: word.from - 5, // account for "Math."
            to: word.to,
            options: filtered,
            validFor: (text: string) => text.startsWith('Math.'),
          }
        }
      }
    }

    // Build completions based on context
    const text = word?.text ?? ''
    const lowered = text.toLowerCase()
    const from = word?.from ?? cmCtx.pos
    const to = word?.to ?? cmCtx.pos

    const options: Completion[] = [
      ...keywordCompletions(context.statementKind),
      ...variableCompletions(context.variables),
      ...functionCompletions(context.functions),
      ...BUILTIN_MATH,
    ]

    // Filter by prefix if user has typed something
    if (text.length > 0) {
      const filtered = options.filter((c) =>
        c.label.toLowerCase().startsWith(lowered),
      )
      return {
        from,
        to,
        options: filtered,
        validFor: (input: string) => {
          // Re-filter based on current input
          const current = input.toLowerCase()
          return options.some((c) => c.label.toLowerCase().startsWith(current))
        },
      }
    }

    return {
      from,
      to,
      options,
    }
  }
}
