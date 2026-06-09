<script setup lang="ts">
import { computed } from 'vue'
import type { Statement } from '../../fprg-ast'

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
// Kind → 中文标题
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

const kindLabel = computed(() =>
  props.statement ? (KIND_LABELS[props.statement.kind] ?? props.statement.kind) : ''
)

// ============================================================
// Helper: emit update after mutating a field
// ============================================================

function setField<K extends keyof Statement>(key: K, value: Statement[K]) {
  if (!props.statement) return
  ;(props.statement as Record<string, unknown>)[key as string] = value
  emit('update', props.statement)
}
</script>

<template>
  <div v-if="statement" class="prop-editor">
    <!-- Header -->
    <div class="editor-header">
      <span class="editor-kind">{{ kindLabel }}</span>
      <button class="editor-done-btn" @click="emit('close')">✓ 完成</button>
    </div>

    <!-- ===== declare ===== -->
    <template v-if="statement.kind === 'declare'">
      <label class="field">
        <span class="field-label">变量名</span>
        <input
          class="field-input"
          type="text"
          :value="statement.name"
          @input="setField('name', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="field">
        <span class="field-label">类型</span>
        <select
          class="field-input"
          :value="statement.type"
          @change="setField('type', ($event.target as HTMLSelectElement).value)"
        >
          <option value="Integer">整数 (Integer)</option>
          <option value="Real">实数 (Real)</option>
          <option value="String">字符串 (String)</option>
          <option value="Boolean">布尔 (Boolean)</option>
        </select>
      </label>
      <label class="field field-row">
        <input
          type="checkbox"
          :checked="statement.array"
          @change="setField('array', ($event.target as HTMLInputElement).checked)"
        />
        <span class="field-label">数组</span>
      </label>
      <label v-if="statement.array" class="field">
        <span class="field-label">数组大小</span>
        <input
          class="field-input"
          type="text"
          :value="statement.size"
          @input="setField('size', ($event.target as HTMLInputElement).value)"
        />
      </label>
    </template>

    <!-- ===== assign ===== -->
    <template v-if="statement.kind === 'assign'">
      <label class="field">
        <span class="field-label">变量</span>
        <input
          class="field-input"
          type="text"
          :value="statement.variable"
          @input="setField('variable', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="field">
        <span class="field-label">表达式</span>
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
        <span class="field-label">变量名</span>
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
        <span class="field-label">表达式</span>
        <input
          class="field-input"
          type="text"
          :value="statement.expression"
          @input="setField('expression', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="field field-row">
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
        <span class="field-label">函数调用</span>
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
        <span class="field-label">条件表达式</span>
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
        <span class="field-label">条件表达式</span>
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
        <span class="field-label">循环变量</span>
        <input
          class="field-input"
          type="text"
          :value="statement.variable"
          @input="setField('variable', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="field">
        <span class="field-label">起始值</span>
        <input
          class="field-input"
          type="text"
          :value="statement.start"
          @input="setField('start', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="field">
        <span class="field-label">终止值</span>
        <input
          class="field-input"
          type="text"
          :value="statement.end"
          @input="setField('end', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="field">
        <span class="field-label">步长</span>
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
</template>

<style scoped>
.prop-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 260px;
}

/* ---- Header ---- */
.editor-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #444;
  margin-bottom: 4px;
}

.editor-kind {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #4fc3f7;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.editor-done-btn {
  background: #27ae60;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 4px;
  transition: background 0.15s;
}
.editor-done-btn:hover {
  background: #2ecc71;
}

/* ---- Fields ---- */
.field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-row {
  flex-direction: row;
  justify-content: flex-start;
}

.field-label {
  font-size: 12px;
  color: #aaa;
  white-space: nowrap;
  min-width: 60px;
}

.field-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid #555;
  border-radius: 4px;
  color: #eee;
  font-size: 12px;
  padding: 5px 8px;
  outline: none;
  transition: border-color 0.15s;
}

.field-input:focus {
  border-color: #4fc3f7;
}

.field-input::placeholder {
  color: #666;
}

select.field-input {
  cursor: pointer;
}

select.field-input option {
  background: #1e1e32;
  color: #eee;
}

input[type="checkbox"] {
  accent-color: #4fc3f7;
  cursor: pointer;
}

.no-props {
  color: #888;
  font-size: 12px;
  font-style: italic;
  text-align: center;
  padding: 12px 0;
}
</style>
