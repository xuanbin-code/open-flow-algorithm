<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChatMessage } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

const { t } = useI18n()

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
// Input state
// ============================================================

const inputValue = ref('')
const hasInteracted = ref(false)

// ============================================================
// Chat auto-scroll
// ============================================================

const chatEl = ref<InstanceType<typeof ScrollArea> | null>(null)

function scrollToBottom() {
  const viewport: HTMLElement | null | undefined = chatEl.value?.$el?.querySelector('[data-reka-scroll-area-viewport]')
  if (viewport) {
    viewport.scrollTop = viewport.scrollHeight
  }
}

watch(
  () => props.chatMessages.length,
  async () => {
    await nextTick()
    scrollToBottom()
  },
)

watch(
  () => props.executionStatus,
  async (status) => {
    if (status === 'waiting-input') {
      hasInteracted.value = false
      inputValue.value = ''
      await nextTick()
      scrollToBottom()
      const el = document.querySelector<HTMLInputElement>('[data-console-input]')
      el?.focus()
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
  hasInteracted.value = true
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
// Status badge
// ============================================================

const STATUS_LABELS: Record<string, string> = {
  idle: t('execution.status.idle'),
  running: t('execution.status.running'),
  paused: t('execution.status.paused'),
  'waiting-input': t('execution.status.waitingInput'),
  stopped: t('execution.status.stopped'),
}

import type { BadgeVariants } from '@/components/ui/badge'

const STATUS_VARIANTS: Record<string, BadgeVariants['variant']> = {
  idle: 'secondary',
  running: 'default',
  paused: 'secondary',
  'waiting-input': 'default',
  stopped: 'destructive',
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}
</script>

<template>
  <Card class="exec-console flex h-full flex-col rounded-none border-0">
    <CardHeader class="inspector-header">
      <div class="title-stack">
        <CardTitle class="text-sm font-semibold">
          {{ $t('execution.runInspector') }}
        </CardTitle>
        <span class="subtitle">{{ $t('execution.title') }}</span>
      </div>
      <Badge :variant="STATUS_VARIANTS[executionStatus] ?? 'secondary'" class="text-[10px]">
        {{ STATUS_LABELS[executionStatus] ?? executionStatus }}
      </Badge>
      <Button variant="ghost" size="xs" class="ml-auto text-xs" @click="emit('clear')">
        {{ $t('execution.clear') }}
      </Button>
    </CardHeader>

    <CardContent class="flex flex-1 flex-col gap-0 overflow-hidden p-0">
      <ScrollArea ref="chatEl" class="flex-1">
        <div class="message-list">
          <div v-if="chatMessages.length === 0" class="empty-state">
            <span class="empty-title">{{ $t('execution.hintRunFirst') }}</span>
            <span class="empty-copy">{{ $t('execution.emptyHintDesc') }}</span>
          </div>
          <template v-for="(msg, i) in chatMessages" :key="i">
            <!-- Run separator -->
            <div
              v-if="msg.separator === 'run-start'"
              class="run-separator"
            >
              <span class="run-separator-line" />
              <span class="run-separator-text">{{ msg.text }}</span>
              <span class="run-separator-line" />
            </div>
            <!-- Normal bubble -->
            <div
              v-else
              class="chat-bubble"
              :class="[
                `bubble-${msg.role}`,
                { 'cursor-pointer hover:brightness-110': msg.role === 'program' && msg.sourceNodeId },
              ]"
              @click="msg.role === 'program' && msg.sourceNodeId && onOutputClick(msg.sourceNodeId)"
            >
              <span v-if="msg.role === 'program'" class="bubble-sender">
                {{ $t('execution.program') }}
                <span v-if="msg.timestamp" class="bubble-time">{{ formatTime(msg.timestamp) }}</span>
              </span>
              <span v-else-if="msg.role === 'user'" class="bubble-sender">
                {{ $t('execution.you') }}
                <span v-if="msg.timestamp" class="bubble-time">{{ formatTime(msg.timestamp) }}</span>
              </span>
              <span class="bubble-text">{{ msg.text }}</span>
            </div>
          </template>
        </div>
      </ScrollArea>

      <div
        class="chat-input-bar"
        :class="{
          'opacity-50': executionStatus !== 'waiting-input',
          'input-waiting': executionStatus === 'waiting-input' && !hasInteracted,
        }"
      >
        <Input
          v-model="inputValue"
          data-console-input
          class="flex-1"
          :class="{ 'ring-2 ring-ring input-glow': executionStatus === 'waiting-input' && !hasInteracted }"
          :placeholder="
            executionStatus === 'waiting-input'
              ? $t('execution.inputPlaceholder', { name: variableName })
              : $t('execution.waitingForRun')
          "
          :disabled="executionStatus !== 'waiting-input'"
          @mousedown="hasInteracted = true"
          @keydown="onInputKeydown"
        />
        <Button
          class="send-btn"
          :class="{ 'btn-breathe': executionStatus === 'waiting-input' && !hasInteracted }"
          size="sm"
          :disabled="executionStatus !== 'waiting-input'"
          @click="onSubmit"
        >
          {{ $t('execution.send') }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>

<style scoped>
.exec-console {
  background: var(--bg-panel);
}

.inspector-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--border-soft);
}

.title-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.subtitle {
  color: var(--text-muted);
  font-size: 11px;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}

.empty-state {
  display: flex;
  min-height: 160px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px;
  text-align: center;
}

.empty-title {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.empty-copy {
  max-width: 240px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

/* Chat bubbles */
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

.bubble-time {
  font-size: 9px;
  opacity: 0.5;
  margin-left: 6px;
  font-weight: 400;
}

/* Run separator */
.run-separator {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}

.run-separator-line {
  flex: 1;
  height: 1px;
  background: var(--border-soft);
}

.run-separator-text {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Input bar */
.chat-input-bar {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--border-soft);
  flex-shrink: 0;
  transition: opacity 0.25s ease, border-color 0.4s ease;
}

/* ---- Input waiting animations ---- */

@keyframes bar-attention {
  0%, 100% {
    border-top-color: var(--border-soft);
    box-shadow: inset 0 1px 0 transparent;
  }
  50% {
    border-top-color: color-mix(in srgb, var(--ring) 55%, transparent);
    box-shadow: inset 0 1px 0 color-mix(in srgb, var(--ring) 18%, transparent);
  }
}

@keyframes bar-shake {
  /* 在 2.2s 周期中，前 0.35s (16%) 抖动，剩余时间静止 */
  0%, 16%, 100% { transform: translateX(0); }
  2%  { transform: translateX(-4px); }
  5%  { transform: translateX(4px); }
  8%  { transform: translateX(-3px); }
  11% { transform: translateX(2px); }
  14% { transform: translateX(-1px); }
}

.input-waiting {
  animation: bar-attention 2s ease-in-out infinite, bar-shake 2.2s ease-in-out infinite;
}

@keyframes input-ring-glow {
  0%, 100% {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent),
                0 0 8px 1px color-mix(in srgb, var(--ring) 10%, transparent);
  }
  50% {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 55%, transparent),
                0 0 18px 3px color-mix(in srgb, var(--ring) 28%, transparent),
                0 0 36px 6px color-mix(in srgb, var(--ring) 8%, transparent);
  }
}

.input-glow {
  animation: input-ring-glow 1.8s ease-in-out infinite;
}

@keyframes btn-breathe {
  0%, 100% {
    box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 18%, transparent);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 2px 20px color-mix(in srgb, var(--accent) 50%, transparent),
                0 4px 36px color-mix(in srgb, var(--accent) 22%, transparent);
    transform: scale(1.03);
  }
}

.btn-breathe {
  animation: btn-breathe 1.6s ease-in-out infinite;
}

/* Send button — filled accent style for clear affordance */
.send-btn {
  background: var(--accent) !important;
  color: var(--accent-foreground) !important;
  font-weight: 600;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 18%, transparent);
}

.send-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 85%, black) !important;
}

.send-btn:disabled {
  background: var(--btn-ghost-bg) !important;
  color: var(--btn-disabled-text) !important;
  opacity: 1 !important;
  box-shadow: none;
}
</style>
