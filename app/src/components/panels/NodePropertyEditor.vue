<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import type { Statement } from '../../engine/fprg-ast'
import { Package, Pencil, ArrowDownToLine, ArrowUpFromLine, GitBranch, Repeat, RefreshCw, Clipboard } from '../icons'

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  statement: Statement | null
}>()

const emit = defineEmits<{
  update: [stmt: Statement]
  close: []
}>()

// ============================================================
// Kind → 中文标签 & 描述
// ============================================================

const KIND_LABELS: Record<string, string> = {
  declare: '声明',
  assign: '赋值',
  input: '输入',
  output: '输出',
  call: '函数调用',
  if: '判断',
  while: 'while 循环',
  for: 'for 循环',
  do: 'do 循环',
  more: '占位',
}

const KIND_DESCRIPTIONS: Record<string, string> = {
  declare: '声明，用来创建程序运行中存储数据用的变量或数组。',
  assign: '赋值，用来修改变量或数组元素的值。',
  input: '输入，从用户获取数据并存储到变量中。',
  output: '输出，将表达式的结果显示给用户。',
  if: '判断，根据条件表达式的真假选择不同的执行路径。',
  for: 'For 循环，按照指定的次数重复执行一组语句。',
  while: 'While 循环，当条件为真时重复执行一组语句。',
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

const kindIcon = computed(() =>
  props.statement ? (KIND_ICONS[props.statement.kind] ?? Clipboard) : Clipboard
)

const kindLabel = computed(() =>
  props.statement ? (KIND_LABELS[props.statement.kind] ?? props.statement.kind) : ''
)

const kindDescription = computed(() =>
  props.statement ? (KIND_DESCRIPTIONS[props.statement.kind] ?? '') : ''
)

// ============================================================
// Declare 类型选项
// ============================================================

const DECLARE_TYPES = [
  { value: 'Integer', label: '整数值' },
  { value: 'Real', label: '实数值' },
  { value: 'String', label: '字符串' },
  { value: 'Boolean', label: '逻辑值' },
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
          <span class="field-label">变量名称:</span>
          <input
            class="field-input"
            type="text"
            placeholder="输入变量名称"
            :value="statement.name"
            @input="setField('name', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <div class="field field-block">
          <span class="field-label">类型:</span>
          <div class="radio-group">
            <label
              v-for="dt in DECLARE_TYPES"
              :key="dt.value"
              class="radio-item"
              :class="{ checked: statement.type === dt.value }"
            >
              <input
                type="radio"
                :value="dt.value"
                :checked="statement.type === dt.value"
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
            @change="setField('array', ($event.target as HTMLInputElement).checked)"
          />
          <span class="field-label">数组?</span>
        </label>

        <label v-if="statement.array" class="field">
          <span class="field-label">
            数组大小
            <span v-if="isArrayLiteral" class="auto-hint">（自动）</span>
            :
          </span>
          <input
            class="field-input"
            :class="{ disabled: isArrayLiteral }"
            type="text"
            :placeholder="isArrayLiteral ? '由初始值自动计算' : '输入数组大小'"
            :value="statement.size"
            :disabled="isArrayLiteral"
            @input="setField('size', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <label class="field">
          <span class="field-label">初始值:</span>
          <input
            class="field-input"
            type="text"
            placeholder="可选，如 5 或 [1,2,3]"
            :value="statement.expression"
            @input="onExpressionInput(($event.target as HTMLInputElement).value)"
          />
        </label>
      </template>

      <!-- ===== assign ===== -->
      <template v-if="statement.kind === 'assign'">
        <label class="field">
          <span class="field-label">变量:</span>
          <input
            class="field-input"
            type="text"
            :value="statement.variable"
            @input="setField('variable', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="field">
          <span class="field-label">表达式:</span>
          <input
            class="field-input"
            type="text"
            :value="statement.expression"
            @input="setField('expression', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </template>

      <!-- ===== input ===== -->
      <template v-if="statement.kind === 'input'">
        <label class="field">
          <span class="field-label">变量名:</span>
          <input
            class="field-input"
            type="text"
            :value="statement.variable"
            @input="setField('variable', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </template>

      <!-- ===== output ===== -->
      <template v-if="statement.kind === 'output'">
        <label class="field">
          <span class="field-label">表达式:</span>
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
          <span class="field-label">输出后换行</span>
        </label>
      </template>

      <!-- ===== call ===== -->
      <template v-if="statement.kind === 'call'">
        <label class="field">
          <span class="field-label">函数调用:</span>
          <input
            class="field-input"
            type="text"
            :value="statement.expression"
            @input="setField('expression', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </template>

      <!-- ===== if ===== -->
      <template v-if="statement.kind === 'if'">
        <label class="field">
          <span class="field-label">条件表达式:</span>
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
          <span class="field-label">条件表达式:</span>
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
        <label class="field">
          <span class="field-label">循环变量:</span>
          <input
            class="field-input"
            type="text"
            :value="statement.variable"
            @input="setField('variable', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="field">
          <span class="field-label">起始值:</span>
          <input
            class="field-input"
            type="text"
            :value="statement.start"
            @input="setField('start', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="field">
          <span class="field-label">终止值:</span>
          <input
            class="field-input"
            type="text"
            :value="statement.end"
            @input="setField('end', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="field">
          <span class="field-label">步长:</span>
          <input
            class="field-input"
            type="text"
            :value="statement.step"
            @input="setField('step', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </template>

      <!-- ===== more ===== -->
      <template v-if="statement.kind === 'more'">
        <div class="no-props">此节点无属性可编辑</div>
      </template>
    </div>

    <!-- Footer buttons -->
    <div class="editor-footer">
      <button class="btn-cancel" @click="emit('close')">取消</button>
      <button class="btn-confirm" @click="onConfirm">确定</button>
    </div>
  </div>
</template>

<style scoped>
.prop-editor {
  display: flex;
  flex-direction: column;
  min-width: 320px;
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
</style>
