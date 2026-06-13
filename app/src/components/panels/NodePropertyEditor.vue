<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Statement, FunctionDef, DeclareStatement } from '../../engine/fprg-ast'
import { Package, Pencil, ArrowDownToLine, ArrowUpFromLine, GitBranch, Repeat, RefreshCw, Clipboard, Undo2, Import } from '../icons'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

const { t } = useI18n()

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  statement: Statement | null
  allFunctions?: FunctionDef[]
}>()

const emit = defineEmits<{
  update: [stmt: Statement]
  close: []
}>()

// ============================================================
// Kind → 中文标签 & 描述
// ============================================================

const KIND_LABELS: Record<string, string> = {
  declare: t('nodes.kind.declare'),
  assign: t('nodes.kind.assign'),
  input: t('nodes.kind.input'),
  output: t('nodes.kind.output'),
  call: t('nodes.kind.call'),
  if: t('nodes.kind.if'),
  while: t('nodes.kind.while'),
  for: t('nodes.kind.for'),
  do: t('nodes.kind.do'),
  more: t('nodes.kind.more'),
}

const KIND_DESCRIPTIONS: Record<string, string> = {
  declare: t('nodes.description.declare'),
  assign: t('nodes.description.assign'),
  input: t('nodes.description.input'),
  output: t('nodes.description.output'),
  if: t('nodes.description.if'),
  for: t('nodes.description.for'),
  while: t('nodes.description.while'),
}

const KIND_ICONS: Record<string, Component> = {
  declare: Package,
  assign: Pencil,
  input: ArrowDownToLine,
  output: ArrowUpFromLine,
  if: GitBranch,
  for: Repeat,
  while: RefreshCw,
}

// 标记声明节点的 tag（仅 declare 类型）
const declareTag = computed(() => {
  if (!props.statement || props.statement.kind !== 'declare') return undefined
  return (props.statement as DeclareStatement).tag
})

const isDeclareReadonly = computed(() => declareTag.value !== undefined)

const kindIcon = computed(() => {
  if (!props.statement) return Clipboard
  if (props.statement.kind === 'declare') {
    const tag = declareTag.value
    if (tag === 'return') return Undo2
    if (tag === 'parameter') return Import
  }
  return KIND_ICONS[props.statement.kind] ?? Clipboard
})

const kindLabel = computed(() => {
  if (!props.statement) return ''
  if (props.statement.kind === 'declare') {
    const tag = declareTag.value
    if (tag === 'return') return t('nodes.kind.declareReturn')
    if (tag === 'parameter') return t('nodes.kind.declareParameter')
  }
  return KIND_LABELS[props.statement.kind] ?? props.statement.kind
})

const kindDescription = computed(() => {
  if (!props.statement) return ''
  if (props.statement.kind === 'declare') {
    const tag = declareTag.value
    if (tag === 'return') return t('nodes.description.declareReturn')
    if (tag === 'parameter') return t('nodes.description.declareParameter')
  }
  return KIND_DESCRIPTIONS[props.statement.kind] ?? ''
})

/** 仅普通声明节点显示初始值字段；tag 节点不需要（参数值来自调用者，返回值来自函数体赋值） */
const showExpression = computed(() => {
  if (!props.statement || props.statement.kind !== 'declare') return true
  return declareTag.value === undefined
})

// ============================================================
// Declare 类型选项
// ============================================================

const DECLARE_TYPES = [
  { value: 'Integer', label: t('nodes.type.Integer') },
  { value: 'Real', label: t('nodes.type.Real') },
  { value: 'String', label: t('nodes.type.String') },
  { value: 'Boolean', label: t('nodes.type.Boolean') },
]

// ============================================================
// Helper: emit update after mutating a field
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setField(key: string, value: any) {
  if (!props.statement) return
  ;(props.statement as unknown as Record<string, unknown>)[key] = value
  emit('update', props.statement)
}

// ============================================================
// Array literal detection (declare 数组初始化)
// ============================================================

const isArrayLiteral = computed(() => {
  if (!props.statement || props.statement.kind !== 'declare') return false
  const expr = props.statement.expression || ''
  return /^\s*\[.*\]\s*$/.test(expr)
})

function onExpressionInput(value: string) {
  if (!props.statement || props.statement.kind !== 'declare') return
  setField('expression', value)

  // 数组字面量 → 自动计算 size
  if (props.statement.array) {
    const trimmed = value.trim()
    if (/^\s*\[.*\]\s*$/.test(trimmed)) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          setField('size', String(parsed.length))
        }
      } catch {
        // JSON 解析失败（含变量引用如 [1, N, 3]）→ 保留原 size
      }
    }
  }
}

// ============================================================
// For loop: direction & spin buttons
// ============================================================

const forDirection = computed(() => {
  if (!props.statement || props.statement.kind !== 'for') return 'inc'
  const raw = (props.statement as unknown as Record<string, unknown>).direction
  if (raw === 'inc' || raw === 'dec') return raw
  // 根据起始/终止值推断方向
  const s = parseFloat(props.statement.start)
  const e = parseFloat(props.statement.end)
  if (!isNaN(s) && !isNaN(e)) return e >= s ? 'inc' : 'dec'
  return 'inc'
})

function setDirection(dir: 'inc' | 'dec') {
  if (!props.statement || props.statement.kind !== 'for') return
  const prev = forDirection.value
  if (dir === prev) return
  setField('direction', dir)
  // 交换起始/终止值
  const start = props.statement.start
  const end = props.statement.end
  setField('start', end)
  setField('end', start)
}

function spinValue(field: 'start' | 'end' | 'step', delta: number) {
  if (!props.statement || props.statement.kind !== 'for') return
  const raw = (props.statement as unknown as Record<string, string>)[field] ?? '0'
  const num = parseFloat(raw) || 0
  setField(field, String(num + delta))
}

// ============================================================
// Call editor: dual-mode state & helpers
// ============================================================

const callMode = ref<'guided' | 'free'>('guided')
const callSelectedFuncName = ref('')
const callParamValues = ref<string[]>([])
const callResultVar = ref('')
const isCallSyncing = ref(false)

const availableCallFunctions = computed(() =>
  props.allFunctions?.filter(f => f.name !== 'Main') ?? [],
)

const callSelectedFunc = computed(() =>
  props.allFunctions?.find(f => f.name === callSelectedFuncName.value),
)

const callParsedFuncType = computed(() => {
  if (!props.statement || props.statement.kind !== 'call') return undefined
  const parsed = parseCallExpression(props.statement.expression)
  if (!parsed) return undefined
  const func = props.allFunctions?.find(f => f.name === parsed.name)
  return func?.type
})

const callShowResultField = computed(() => {
  if (callMode.value === 'guided') {
    return callSelectedFunc.value?.type !== 'None'
  }
  const ft = callParsedFuncType.value
  return ft !== undefined && ft !== 'None'
})

/** 解析 "FuncName(arg1, arg2, ...)" 格式的调用表达式 */
function parseCallExpression(expr: string): { name: string; args: string[] } | null {
  const trimmed = expr.trim()
  const match = trimmed.match(/^(\w+)\s*\(([\s\S]*)\)$/)
  if (!match) return null

  const funcName = match[1]
  const argsStr = match[2].trim()
  if (!argsStr) return { name: funcName, args: [] }

  const args: string[] = []
  let depth = 0, current = ''
  for (const ch of argsStr) {
    if (ch === '(') { depth++; current += ch }
    else if (ch === ')') { depth--; current += ch }
    else if (ch === ',' && depth === 0) { args.push(current); current = '' }
    else { current += ch }
  }
  if (current) args.push(current)
  return { name: funcName, args }
}

function buildCallExpression(): string {
  const func = callSelectedFunc.value
  if (!func) return ''
  return func.name + '(' + callParamValues.value.join(', ') + ')'
}

function syncFromExpression() {
  if (!props.statement || props.statement.kind !== 'call') return
  isCallSyncing.value = true

  const expr = props.statement.expression
  if (!expr) {
    callMode.value = 'guided'
    callSelectedFuncName.value = ''
    callParamValues.value = []
    callResultVar.value = props.statement.result || ''
    isCallSyncing.value = false
    return
  }

  const parsed = parseCallExpression(expr)
  const func = parsed ? props.allFunctions?.find(f => f.name === parsed.name) : undefined

  if (!parsed || !func) {
    callMode.value = 'free'
    callResultVar.value = props.statement.result || ''
    isCallSyncing.value = false
    return
  }

  callMode.value = 'guided'
  callSelectedFuncName.value = parsed.name
  const values = new Array(func.parameters.length).fill('')
  for (let i = 0; i < Math.min(func.parameters.length, parsed.args.length); i++) {
    values[i] = parsed.args[i].trim()
  }
  callParamValues.value = values
  callResultVar.value = props.statement.result || ''
  isCallSyncing.value = false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onCallFuncChange(value: any) {
  const name = String(value ?? '')
  if (!name || !props.statement || props.statement.kind !== 'call' || isCallSyncing.value) return
  const func = props.allFunctions?.find(f => f.name === name)
  if (!func) return
  callSelectedFuncName.value = name
  callParamValues.value = new Array(func.parameters.length).fill('')
  callResultVar.value = ''
  setField('result', undefined)
  setField('expression', func.name + '(' + func.parameters.map(() => '').join(', ') + ')')
}

function onCallParamInput(index: number, value: string) {
  if (!props.statement || props.statement.kind !== 'call') return
  const newValues = [...callParamValues.value]
  newValues[index] = value
  callParamValues.value = newValues
  setField('expression', buildCallExpression())
}

function onCallResultVarInput(value: string) {
  if (!props.statement || props.statement.kind !== 'call') return
  callResultVar.value = value
  setField('result', value || undefined)
}

function switchCallMode(target: 'guided' | 'free') {
  if (target === 'guided') {
    syncFromExpression()
  } else {
    callMode.value = 'free'
  }
}

// 每次打开编辑面板（statement 变化）时，从当前表达式同步状态
watch(() => props.statement, () => syncFromExpression(), { immediate: true })

function onConfirm() {
  if (!props.statement) return
  emit('update', props.statement)
  emit('close')
}
</script>

<template>
  <div v-if="statement" class="prop-editor">
    <!-- Info banner -->
    <div v-if="kindDescription" class="info-banner">
      <component :is="kindIcon" class="info-icon" :size="22" />
      <div class="info-content">
        <span class="info-title">{{ kindLabel }}</span>
        <span class="info-desc">{{ kindDescription }}</span>
      </div>
    </div>

    <!-- Form body -->
    <div class="editor-body">
      <!-- ===== declare ===== -->
      <template v-if="statement.kind === 'declare'">
        <label class="field">
          <span class="field-label">{{ $t('editor.form.variableName') }}</span>
          <input
            class="field-input"
            :class="{ 'field-readonly': isDeclareReadonly }"
            type="text"
            :disabled="isDeclareReadonly"
            :placeholder="$t('editor.form.namePlaceholder')"
            :value="statement.name"
            @input="setField('name', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <div class="field field-block">
          <span class="field-label">{{ $t('editor.form.type') }}</span>
          <div class="radio-group">
            <label
              v-for="dt in DECLARE_TYPES"
              :key="dt.value"
              class="radio-item"
              :class="{ checked: statement.type === dt.value, 'radio-readonly': isDeclareReadonly }"
            >
              <input
                type="radio"
                :value="dt.value"
                :checked="statement.type === dt.value"
                :disabled="isDeclareReadonly"
                @change="setField('type', dt.value)"
              />
              <span class="radio-mark" />
              <span class="radio-label">{{ dt.label }}</span>
            </label>
          </div>
        </div>

        <label class="field field-check">
          <input
            type="checkbox"
            :checked="statement.array"
            :disabled="isDeclareReadonly"
            @change="setField('array', ($event.target as HTMLInputElement).checked)"
          />
          <span class="field-label">{{ $t('editor.form.isArray') }}</span>
        </label>

        <label v-if="statement.array && declareTag !== 'parameter'" class="field">
          <span class="field-label">
            {{ $t('editor.form.arraySize') }}
            <span v-if="isArrayLiteral" class="auto-hint">{{ $t('editor.form.auto') }}</span>
            :
          </span>
          <input
            class="field-input"
            :class="{ disabled: isArrayLiteral }"
            type="text"
            :placeholder="isArrayLiteral ? $t('editor.form.autoPlaceholder') : $t('editor.form.sizePlaceholder')"
            :value="statement.size"
            :disabled="isArrayLiteral"
            @input="setField('size', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <label v-if="showExpression" class="field">
          <span class="field-label">{{ $t('editor.form.initialValue') }}</span>
          <input
            class="field-input"
            type="text"
            :placeholder="$t('editor.form.optionalExpr')"
            :value="statement.expression"
            @input="onExpressionInput(($event.target as HTMLInputElement).value)"
          />
        </label>
      </template>

      <!-- ===== assign ===== -->
      <template v-if="statement.kind === 'assign'">
        <div class="assign-layout">
          <div class="assign-left">
            <span class="field-label">{{ $t('editor.form.variable') }}</span>
            <input
              class="field-input"
              type="text"
              :placeholder="$t('editor.form.variablePlaceholder')"
              :value="statement.variable"
              @input="setField('variable', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <span class="assign-equals">=</span>
          <div class="assign-right">
            <span class="field-label">{{ $t('editor.form.expression') }}</span>
            <textarea
              class="field-input"
              :placeholder="$t('editor.form.expressionPlaceholder')"
              rows="3"
              :value="statement.expression"
              @input="setField('expression', ($event.target as HTMLTextAreaElement).value)"
            />
          </div>
        </div>
      </template>

      <!-- ===== input ===== -->
      <template v-if="statement.kind === 'input'">
        <label class="field">
          <span class="field-label">{{ $t('editor.form.variableName') }}</span>
          <input
            class="field-input"
            type="text"
            :placeholder="$t('editor.form.namePlaceholder')"
            :value="statement.variable"
            @input="setField('variable', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </template>

      <!-- ===== output ===== -->
      <template v-if="statement.kind === 'output'">
        <label class="field">
          <span class="field-label">{{ $t('editor.form.expression') }}</span>
          <input
            class="field-input"
            type="text"
            :value="statement.expression"
            @input="setField('expression', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="field field-check">
          <input
            type="checkbox"
            :checked="statement.newline"
            @change="setField('newline', ($event.target as HTMLInputElement).checked)"
          />
          <span class="field-label">{{ $t('editor.form.newlineAfterOutput') }}</span>
        </label>
      </template>

      <!-- ===== call (dual-mode) ===== -->
      <template v-if="statement.kind === 'call'">
        <!-- 模式切换条 -->
        <div v-if="availableCallFunctions.length > 0" class="call-mode-bar">
          <button
            class="mode-btn"
            :class="{ active: callMode === 'guided' }"
            @click="switchCallMode('guided')"
          >
            {{ $t('editor.form.callEditor.guidedMode') }}
          </button>
          <button
            class="mode-btn"
            :class="{ active: callMode === 'free' }"
            @click="switchCallMode('free')"
          >
            {{ $t('editor.form.callEditor.freeMode') }}
          </button>
        </div>

        <!-- ===== 引导模式 ===== -->
        <template v-if="callMode === 'guided' && availableCallFunctions.length > 0">
          <label class="field">
            <span class="field-label">{{ $t('functions.selectFunction') }}</span>
            <Select :model-value="callSelectedFuncName" @update:model-value="onCallFuncChange">
              <SelectTrigger class="field-input call-select-trigger">
                <SelectValue :placeholder="$t('functions.selectFunction')" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{{ $t('functions.title') }}</SelectLabel>
                  <SelectItem
                    v-for="f in availableCallFunctions"
                    :key="f.name"
                    :value="f.name"
                  >
                    {{ f.name }}
                    <Badge v-if="f.parameters.length" variant="secondary" class="param-count-badge">
                      {{ f.parameters.length }}
                    </Badge>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>

          <!-- 参数表单 -->
          <template v-if="callSelectedFunc">
            <label
              v-for="(p, i) in callSelectedFunc.parameters"
              :key="i"
              class="field"
            >
              <span class="field-label">
                {{ p.name }}
                <Badge variant="outline" class="type-badge">
                  {{ p.type }}{{ p.array ? '[]' : '' }}
                </Badge>
              </span>
              <input
                class="field-input"
                type="text"
                :placeholder="p.name"
                :value="callParamValues[i] ?? ''"
                @input="onCallParamInput(i, ($event.target as HTMLInputElement).value)"
              />
            </label>
            <div v-if="callSelectedFunc.parameters.length === 0" class="call-hint">
              {{ $t('editor.form.callEditor.noParams') }}
            </div>

            <!-- 返回值变量（仅当函数有返回类型） -->
            <label v-if="callShowResultField" class="field">
              <span class="field-label">{{ $t('editor.form.callEditor.resultVar') }}</span>
              <input
                class="field-input"
                type="text"
                :placeholder="$t('editor.form.callEditor.resultVarPlaceholder')"
                :value="callResultVar"
                @input="onCallResultVarInput(($event.target as HTMLInputElement).value)"
              />
            </label>
          </template>
          <div v-else class="call-hint">
            {{ $t('editor.form.callEditor.pickFunction') }}
          </div>
        </template>

        <!-- ===== 自由模式 ===== -->
        <template v-else>
          <label class="field">
            <span class="field-label">{{ $t('editor.form.functionCall') }}</span>
            <input
              class="field-input"
              type="text"
              :value="statement.expression"
              :placeholder="$t('editor.form.functionCallPlaceholder')"
              @input="setField('expression', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <!-- 自由模式下：如果表达式匹配到有返回类型的函数，也显示返回值字段 -->
          <label v-if="callShowResultField" class="field">
            <span class="field-label">{{ $t('editor.form.callEditor.resultVar') }}</span>
            <input
              class="field-input"
              type="text"
              :placeholder="$t('editor.form.callEditor.resultVarPlaceholder')"
              :value="callResultVar"
              @input="onCallResultVarInput(($event.target as HTMLInputElement).value)"
            />
          </label>
        </template>
      </template>

      <!-- ===== if ===== -->
      <template v-if="statement.kind === 'if'">
        <label class="field">
          <span class="field-label">{{ $t('editor.form.condition') }}</span>
          <input
            class="field-input"
            type="text"
            :value="statement.expression"
            @input="setField('expression', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </template>

      <!-- ===== while / do ===== -->
      <template v-if="statement.kind === 'while' || statement.kind === 'do'">
        <label class="field">
          <span class="field-label">{{ $t('editor.form.condition') }}</span>
          <input
            class="field-input"
            type="text"
            :value="statement.expression"
            @input="setField('expression', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </template>

      <!-- ===== for ===== -->
      <template v-if="statement.kind === 'for'">
        <div class="for-fields">
        <!-- Row 1: 循环变量 -->
        <label class="field">
          <span class="field-label">{{ $t('editor.form.forVariable') }}</span>
          <input
            class="field-input"
            type="text"
            :placeholder="$t('editor.form.forVarPlaceholder')"
            :value="statement.variable"
            @input="setField('variable', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <!-- Row 2: 起始值 → 终止值 -->
        <div class="for-row">
          <label class="field for-half">
            <span class="field-label">{{ $t('editor.form.startValue') }}</span>
            <div class="spin-wrap">
              <input
                class="field-input spin-input"
                type="text"
                placeholder="0"
                :value="statement.start"
                @input="setField('start', ($event.target as HTMLInputElement).value)"
              />
              <div class="spin-btns">
                <button class="spin-btn" tabindex="-1" @mousedown.prevent="spinValue('start', 1)">▴</button>
                <button class="spin-btn" tabindex="-1" @mousedown.prevent="spinValue('start', -1)">▾</button>
              </div>
            </div>
          </label>
          <span class="for-arrow">→</span>
          <label class="field for-half">
            <span class="field-label">{{ $t('editor.form.endValue') }}</span>
            <div class="spin-wrap">
              <input
                class="field-input spin-input"
                type="text"
                placeholder="10"
                :value="statement.end"
                @input="setField('end', ($event.target as HTMLInputElement).value)"
              />
              <div class="spin-btns">
                <button class="spin-btn" tabindex="-1" @mousedown.prevent="spinValue('end', 1)">▴</button>
                <button class="spin-btn" tabindex="-1" @mousedown.prevent="spinValue('end', -1)">▾</button>
              </div>
            </div>
          </label>
        </div>

        <!-- Row 3: 每步变化 + 方向 -->
        <div class="for-row">
          <label class="field for-half">
            <span class="field-label">{{ $t('editor.form.step') }}</span>
            <div class="spin-wrap">
              <input
                class="field-input spin-input"
                type="text"
                placeholder="1"
                :value="statement.step"
                @input="setField('step', ($event.target as HTMLInputElement).value)"
              />
              <div class="spin-btns">
                <button class="spin-btn" tabindex="-1" @mousedown.prevent="spinValue('step', 1)">▴</button>
                <button class="spin-btn" tabindex="-1" @mousedown.prevent="spinValue('step', -1)">▾</button>
              </div>
            </div>
          </label>
          <div class="for-direction">
            <span class="field-label">{{ $t('editor.form.direction') }}</span>
            <div class="direction-toggle">
              <button
                class="dir-btn"
                :class="{ active: forDirection === 'inc' }"
                @click="setDirection('inc')"
              >{{ $t('editor.form.increment') }}</button>
              <button
                class="dir-btn"
                :class="{ active: forDirection === 'dec' }"
                @click="setDirection('dec')"
              >{{ $t('editor.form.decrement') }}</button>
            </div>
          </div>
        </div>
        </div>
      </template>

      <!-- ===== more ===== -->
      <template v-if="statement.kind === 'more'">
        <div class="no-props">{{ $t('editor.form.noProperties') }}</div>
      </template>
    </div>

    <!-- Footer buttons -->
    <div class="editor-footer">
      <button class="btn-cancel" @click="emit('close')">{{ $t('common.cancel') }}</button>
      <button class="btn-confirm" @click="onConfirm">{{ $t('common.ok') }}</button>
    </div>
  </div>
</template>

<style scoped>
.prop-editor {
  display: flex;
  flex-direction: column;
}

/* ============================================
   Info banner
   ============================================ */
.info-banner {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 16px;
  background: color-mix(in srgb, var(--accent, #1976d2) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent, #1976d2) 12%, transparent);
  border-radius: 8px;
  margin-bottom: 6px;
}

.info-icon {
  color: var(--accent);
  flex-shrink: 0;
  margin-top: 1px;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.info-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}

.info-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  word-break: break-word;
  overflow-wrap: break-word;
}

/* ============================================
   Form body
   ============================================ */
.editor-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0;
}

/* ---- Fields ---- */
.field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-block {
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.field-check {
  flex-direction: row;
  justify-content: flex-start;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  min-width: 60px;
}

.field-block > .field-label {
  min-width: auto;
}

.field-input {
  flex: 1;
  background: var(--bg-hover);
  border: 1px solid var(--dialog-border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 12px;
  padding: 6px 8px;
  outline: none;
  transition: border-color 0.15s;
  font-family: inherit;
  min-height: 28px;
}

/* ---- Assign layout: 变量 = 表达式 ---- */
.assign-layout {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.assign-left {
  flex: 0 0 28%;
  min-width: 80px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.assign-equals {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-secondary);
  user-select: none;
  flex-shrink: 0;
  padding-top: 20px;
}

.assign-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ---- For layout: 循环变量 / 起始→终止 / 步长+方向 ---- */
.for-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.for-fields .field-label {
  width: 70px;
  min-width: 70px;
  flex-shrink: 0;
}

.for-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.for-half {
  flex: 1;
  min-width: 0;
}

.for-arrow {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-muted);
  user-select: none;
  flex-shrink: 0;
  padding-bottom: 5px;
}

/* Spin buttons (数字增减) */
.spin-wrap {
  position: relative;
  flex: 1;
  display: flex;
}

.spin-input {
  padding-right: 24px;
}

.spin-btns {
  position: absolute;
  right: 1px;
  top: 1px;
  bottom: 1px;
  display: flex;
  flex-direction: column;
  width: 16px;
}

.spin-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 8px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  transition: color 0.12s, background 0.12s;
}

.spin-btn:hover {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

/* Direction toggle */
.for-direction {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding-bottom: 1px;
}

.for-direction .field-label {
  min-width: auto;
}

.direction-toggle {
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  overflow: hidden;
}

.dir-btn {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  font-family: inherit;
}

.dir-btn:first-child {
  border-right: 1px solid var(--border-color);
}

.dir-btn.active {
  background: var(--accent);
  color: #fff;
}

.dir-btn:not(.active):hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.field-input:focus {
  border-color: var(--accent);
}

.field-input::placeholder {
  color: var(--text-disabled);
}

.field-input.disabled,
.field-input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: var(--border-soft);
}

/* ---- Readonly field (tagged declare nodes) ---- */
.field-input.field-readonly {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--border-soft);
  user-select: none;
}

.radio-item.radio-readonly {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}

input[type="checkbox"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- "（自动）" hint ---- */
.auto-hint {
  font-size: 10px;
  font-weight: 400;
  color: color-mix(in srgb, var(--accent, #4fc3f7) 80%, #888);
}

/* ---- Radio group ---- */
.radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  transition: border-color 0.15s, background 0.15s, color 0.15s;
  user-select: none;
}

.radio-item:hover {
  border-color: var(--accent);
}

.radio-item.checked {
  border-color: var(--accent);
  background: rgba(79, 195, 247, 0.1);
  color: var(--accent);
  font-weight: 600;
}

[data-theme="dark"] .radio-item.checked {
  background: rgba(79, 195, 247, 0.15);
}

.radio-item input[type="radio"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.radio-mark {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--border-medium);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color 0.15s;
}

.radio-item.checked .radio-mark {
  border-color: var(--accent);
}

.radio-item.checked .radio-mark::after {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
}

.radio-label {
  white-space: nowrap;
}

/* ---- Checkbox ---- */
input[type="checkbox"] {
  accent-color: var(--accent);
  cursor: pointer;
  width: 14px;
  height: 14px;
}

/* ---- No props fallback ---- */
.no-props {
  color: var(--text-muted);
  font-size: 12px;
  font-style: italic;
  text-align: center;
  padding: 12px 0;
}

/* ============================================
   Footer buttons
   ============================================ */
.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  margin-top: 4px;
  border-top: 1px solid var(--border-soft);
}

.btn-cancel,
.btn-confirm {
  padding: 6px 20px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  font-family: inherit;
  border: none;
}

.btn-cancel:active,
.btn-confirm:active {
  transform: scale(0.96);
}

.btn-cancel {
  background: var(--btn-cancel-bg);
  color: var(--text-primary);
}

.btn-cancel:hover {
  background: var(--btn-cancel-hover);
}

.btn-confirm {
  background: var(--btn-primary-bg, #3498db);
  color: #fff;
}

.btn-confirm:hover {
  background: var(--btn-primary-hover, #2980b9);
}

/* ============================================
   Call editor: dual-mode
   ============================================ */

/* 模式切换条 */
.call-mode-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}

.mode-btn {
  flex: 1;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  font-family: inherit;
}

.mode-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.mode-btn:not(.active):hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

/* shadcn Select 触发器覆写 — 匹配 .field-input 风格 */
.call-select-trigger {
  height: auto !important;
  min-height: 28px !important;
  padding: 6px 8px !important;
  font-size: 12px !important;
  font-family: inherit !important;
  background: var(--bg-hover) !important;
  border: 1px solid var(--dialog-border) !important;
  border-radius: 4px !important;
  color: var(--text-primary) !important;
  box-shadow: none !important;
}

.call-select-trigger:focus {
  border-color: var(--accent) !important;
}

/* 下拉面板内选项字体 */
:deep(.call-select-content) {
  font-size: 12px;
}

/* 参数 badge */
.param-count-badge {
  margin-left: auto;
  font-size: 10px;
  padding: 0 5px;
  min-width: 16px;
  text-align: center;
}

.type-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 0 5px;
  line-height: 16px;
  margin-left: 6px;
  flex-shrink: 0;
}

/* 提示文字 */
.call-hint {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
  padding: 8px 0;
}
</style>
