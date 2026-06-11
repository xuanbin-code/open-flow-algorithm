<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

// ============================================================
// Types
// ============================================================

export interface VariableEntry {
  name: string
  type: string
  value: unknown
}

export interface ChatMessage {
  role: 'program' | 'user' | 'system'
  text: string
  sourceNodeId?: string
}

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  chatMessages: ChatMessage[]
  variables: VariableEntry[]
  executionStatus: 'idle' | 'running' | 'paused' | 'waiting-input' | 'stopped'
  variableName: string
}>()

const emit = defineEmits<{
  clear: []
  submitInput: [value: string]
  cancelInput: []
  highlightNode: [nodeId: string]
}>()

// ============================================================
// Chat auto-scroll
// ============================================================

const chatEl = ref<HTMLElement | null>(null)

watch(
  () => props.chatMessages.length,
  async () => {
    await nextTick()
    if (chatEl.value) {
      chatEl.value.scrollTop = chatEl.value.scrollHeight
    }
  },
)

// ============================================================
// Input state
// ============================================================

const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

// 等待输入时自动聚焦
watch(
  () => props.executionStatus,
  async (status) => {
    if (status === 'waiting-input') {
      inputValue.value = ''
      await nextTick()
      inputRef.value?.focus()
    }
  },
)

function onSubmit() {
  const val = inputValue.value
  if (!val && props.executionStatus === 'waiting-input') return
  emit('submitInput', val)
  inputValue.value = ''
}

function onOutputClick(nodeId: string) {
  emit('highlightNode', nodeId)
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    onSubmit()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    inputValue.value = ''
    emit('cancelInput')
  }
}

// ============================================================
// Status label
// ============================================================

const STATUS_LABELS: Record<string, string> = {
  idle: '就绪',
  running: '执行中...',
  paused: '已暂停',
  'waiting-input': '等待输入',
  stopped: '已终止',
}

const STATUS_COLORS: Record<string, string> = {
  idle: '#666',
  running: '#2ecc71',
  paused: '#f39c12',
  'waiting-input': '#3498db',
  stopped: '#e74c3c',
}

// ============================================================
// Value display
// ============================================================

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? '真' : '假'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value)
  return String(value)
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    Integer: '整数',
    Real: '实数',
    String: '字符串',
    Boolean: '布尔',
  }
  return map[type] ?? type
}
</script>

<template>
  <div class="exec-console">
    <!-- Header -->
    <div class="console-header">
      <span class="console-title">运行时</span>
      <span class="status-badge" :style="{ background: STATUS_COLORS[executionStatus] }">
        {{ STATUS_LABELS[executionStatus] ?? executionStatus }}
      </span>
      <button class="clear-btn" title="清空" @click="emit('clear')">清空</button>
    </div>

    <!-- Variable monitor (top) -->
    <div class="vars-section">
      <div class="section-label">变量监视</div>
      <div class="vars-scroll">
        <table v-if="variables.length > 0" class="vars-table">
          <thead>
            <tr>
              <th>变量</th>
              <th>类型</th>
              <th>值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in variables" :key="v.name">
              <td class="var-name">{{ v.name }}</td>
              <td class="var-type">{{ typeLabel(v.type) }}</td>
              <td class="var-value">{{ displayValue(v.value) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-hint">暂无变量</div>
      </div>
    </div>

    <!-- Divider -->
    <div class="section-divider" />

    <!-- Chat dialogue (bottom) -->
    <div class="chat-section">
      <div class="section-label">对话</div>
      <div ref="chatEl" class="chat-messages">
        <div v-if="chatMessages.length === 0" class="empty-hint">
          点击「程序 → 运行」开始执行
        </div>
        <div
          v-for="(msg, i) in chatMessages"
          :key="i"
          class="chat-bubble"
          :class="[`bubble-${msg.role}`, { 'bubble-clickable': msg.role === 'program' && msg.sourceNodeId }]"
          @click="msg.role === 'program' && msg.sourceNodeId && onOutputClick(msg.sourceNodeId)"
        >
          <span v-if="msg.role === 'program'" class="bubble-sender">程序</span>
          <span v-else-if="msg.role === 'user'" class="bubble-sender">你</span>
          <span class="bubble-text">{{ msg.text }}</span>
        </div>
      </div>

      <!-- Input bar (fixed at bottom of chat) -->
      <div class="chat-input-bar" :class="{ disabled: executionStatus !== 'waiting-input' }">
        <input
          ref="inputRef"
          v-model="inputValue"
          class="chat-input"
          type="text"
          :placeholder="
            executionStatus === 'waiting-input'
              ? `输入「${variableName}」的值...`
              : '等待程序运行...'
          "
          :disabled="executionStatus !== 'waiting-input'"
          @keydown="onInputKeydown"
        />
        <button
          class="send-btn"
          :disabled="executionStatus !== 'waiting-input'"
          @click="onSubmit"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exec-console {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-panel);
  color: var(--text-secondary);
  font-size: 12px;
}

/* ---- Header ---- */
.console-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-soft);
  gap: 10px;
  flex-shrink: 0;
}
.console-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.status-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
}
.clear-btn {
  margin-left: auto;
  background: var(--btn-clear-bg);
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}
.clear-btn:hover {
  background: var(--bg-hover-strong);
  color: #ddd;
}

/* ---- Section common ---- */
.section-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-disabled);
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 6px 12px 4px;
  flex-shrink: 0;
}

/* ---- Variable monitor ---- */
.vars-section {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  max-height: 38%;
  overflow: hidden;
}
.vars-scroll {
  overflow-y: auto;
  flex: 1;
  padding: 0 8px 4px;
}
.vars-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.vars-table th {
  text-align: left;
  padding: 3px 6px;
  color: var(--text-muted-3);
  font-weight: 500;
  border-bottom: 1px solid var(--border-soft);
  position: sticky;
  top: 0;
  background: var(--bg-panel);
}
.vars-table td {
  padding: 2px 6px;
  border-bottom: 1px solid var(--border-table);
}
.var-name {
  color: var(--accent);
  font-weight: 600;
}
.var-type {
  color: var(--text-muted-2);
}
.var-value {
  color: var(--accent-green);
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- Section divider ---- */
.section-divider {
  height: 1px;
  background: var(--border-soft);
  flex-shrink: 0;
}

/* ---- Chat section ---- */
.chat-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.empty-hint {
  color: var(--text-placeholder);
  font-style: italic;
  text-align: center;
  padding: 24px 0;
  font-size: 11px;
}

/* ---- Chat bubbles ---- */
.chat-bubble {
  display: flex;
  flex-direction: column;
  max-width: 90%;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.4;
  word-break: break-all;
}
.bubble-sender {
  font-size: 10px;
  font-weight: 600;
  margin-bottom: 2px;
  opacity: 0.7;
}
.bubble-program {
  align-self: flex-start;
  background: var(--bubble-program-bg);
  border: 1px solid var(--bubble-program-border);
  border-bottom-left-radius: 2px;
}
.bubble-program .bubble-sender {
  color: var(--accent-blue);
}
.bubble-user {
  align-self: flex-end;
  background: var(--bubble-user-bg);
  border: 1px solid var(--bubble-user-border);
  border-bottom-right-radius: 2px;
}
.bubble-user .bubble-sender {
  color: var(--accent-green);
}
.bubble-system {
  align-self: center;
  background: var(--bubble-system-bg);
  border: 1px solid var(--bubble-system-border);
  border-radius: 12px;
  font-size: 11px;
  color: var(--text-muted-2);
  font-style: italic;
}
.bubble-text {
  color: var(--text-bubble);
}

.bubble-clickable {
  cursor: pointer;
  transition: filter 0.15s;
}
.bubble-clickable:hover {
  filter: brightness(1.15);
}

/* ---- Input bar ---- */
.chat-input-bar {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.chat-input-bar.disabled {
  opacity: 0.5;
}
.chat-input {
  flex: 1;
  padding: 7px 10px;
  background: var(--bg-input-alt);
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
}
.chat-input:focus {
  border-color: var(--accent);
}
.chat-input:disabled {
  color: var(--text-disabled);
  background: rgba(255, 255, 255, 0.02);
}
.chat-input::placeholder {
  color: var(--text-placeholder);
}
.send-btn {
  padding: 7px 14px;
  background: var(--btn-primary-bg);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
  flex-shrink: 0;
}
.send-btn:hover:not(:disabled) {
  background: var(--btn-primary-hover);
}
.send-btn:disabled {
  background: var(--btn-disabled-bg);
  cursor: not-allowed;
}
</style>
