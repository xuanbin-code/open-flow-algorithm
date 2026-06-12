<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// ============================================================
// Types
// ============================================================

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
  idle: t('execution.status.idle'),
  running: t('execution.status.running'),
  paused: t('execution.status.paused'),
  'waiting-input': t('execution.status.waitingInput'),
  stopped: t('execution.status.stopped'),
}

const STATUS_COLORS: Record<string, string> = {
  idle: '#666',
  running: '#2ecc71',
  paused: '#f39c12',
  'waiting-input': '#3498db',
  stopped: '#e74c3c',
}

</script>

<template>
  <div class="exec-console">
    <!-- Header -->
    <div class="console-header">
      <span class="console-title">{{ $t('execution.title') }}</span>
      <span class="status-badge" :style="{ background: STATUS_COLORS[executionStatus] }">
        {{ STATUS_LABELS[executionStatus] ?? executionStatus }}
      </span>
      <button class="clear-btn" :title="$t('execution.clear')" @click="emit('clear')">{{ $t('execution.clear') }}</button>
    </div>

    <!-- Chat dialogue -->
    <div class="chat-section">
      <div class="section-label">{{ $t('execution.dialogue') }}</div>
      <div ref="chatEl" class="chat-messages">
        <div v-if="chatMessages.length === 0" class="empty-hint">
          {{ $t('execution.hintRunFirst') }}
        </div>
        <div
          v-for="(msg, i) in chatMessages"
          :key="i"
          class="chat-bubble"
          :class="[`bubble-${msg.role}`, { 'bubble-clickable': msg.role === 'program' && msg.sourceNodeId }]"
          @click="msg.role === 'program' && msg.sourceNodeId && onOutputClick(msg.sourceNodeId)"
        >
          <span v-if="msg.role === 'program'" class="bubble-sender">{{ $t('execution.program') }}</span>
          <span v-else-if="msg.role === 'user'" class="bubble-sender">{{ $t('execution.you') }}</span>
          <span class="bubble-text">{{ msg.text }}</span>
        </div>
      </div>

      <!-- Input bar (fixed at bottom of chat) -->
      <div
        class="chat-input-bar"
        :class="{
          disabled: executionStatus !== 'waiting-input',
          'animate__animated animate__pulse animate__infinite': executionStatus === 'waiting-input',
        }"
      >
        <input
          ref="inputRef"
          v-model="inputValue"
          class="chat-input"
          :class="{ 'input-glow': executionStatus === 'waiting-input' }"
          type="text"
          :placeholder="
            executionStatus === 'waiting-input'
              ? $t('execution.inputPlaceholder', { name: variableName })
              : $t('execution.waitingForRun')
          "
          :disabled="executionStatus !== 'waiting-input'"
          @keydown="onInputKeydown"
        />
        <button
          class="send-btn"
          :disabled="executionStatus !== 'waiting-input'"
          @click="onSubmit"
        >
          {{ $t('execution.send') }}
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
  transition: opacity 0.25s ease;
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
  transition: border-color 0.15s, box-shadow 0.25s ease;
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

/* ---- Waiting-input glow ---- */
@keyframes input-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(79, 195, 247, 0); }
  50%      { box-shadow: 0 0 0 3px rgba(79, 195, 247, 0.35); }
}
.input-glow {
  animation: input-glow 2s ease-in-out infinite;
  border-color: var(--accent) !important;
}

/* ---- Accessibility: respect reduced motion ---- */
@media (prefers-reduced-motion: reduce) {
  .animate__animated {
    animation: none !important;
  }
  .input-glow {
    animation: none;
    box-shadow: 0 0 0 2px rgba(79, 195, 247, 0.25);
  }
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
