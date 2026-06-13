<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const { t } = useI18n()

// ============================================================
// Types
// ============================================================

export interface ChatMessage {
  role: 'program' | 'user' | 'system'
  text: string
  sourceNodeId?: string
  timestamp?: number
  separator?: 'run-start'
}

export interface VariableEntry {
  name: string
  type: string
  value: unknown
}

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  chatMessages: ChatMessage[]
  variables?: VariableEntry[]
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
// Input state (declared early — used by watches below)
// ============================================================

const inputValue = ref('')
const hasInteracted = ref(false)
const activePanel = ref<'console' | 'variables'>('console')

// ============================================================
// Chat auto-scroll
// ============================================================

const chatEl = ref<InstanceType<typeof ScrollArea> | null>(null)
const savedScrollTop = ref(0)

function scrollToBottom() {
  const viewport: HTMLElement | null | undefined = chatEl.value?.$el?.querySelector('[data-reka-scroll-area-viewport]')
  if (viewport) {
    viewport.scrollTop = viewport.scrollHeight
  }
}

function getViewport(): HTMLElement | null | undefined {
  return chatEl.value?.$el?.querySelector('[data-reka-scroll-area-viewport]')
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

// 切换 tab 时保存/恢复滚动位置
watch(activePanel, async (panel) => {
  if (panel === 'console') {
    await nextTick()
    const vp = getViewport()
    if (vp && savedScrollTop.value > 0) {
      vp.scrollTop = savedScrollTop.value
    }
  }
})

function switchTab(panel: 'console' | 'variables') {
  if (activePanel.value === 'console' && panel !== 'console') {
    const vp = getViewport()
    if (vp) {
      savedScrollTop.value = vp.scrollTop
    }
  }
  activePanel.value = panel
}

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

const variableCount = computed(() => props.variables?.length ?? 0)

function formatTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return t('execution.nullValueShort')
  if (typeof value === 'boolean') return value ? t('execution.trueValueShort') : t('execution.falseValueShort')
  return String(value)
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

    <div class="inspector-tabs">
      <button
        class="inspector-tab"
        :class="{ active: activePanel === 'console' }"
        @click="switchTab('console')"
      >
        {{ $t('execution.consoleTab') }}
      </button>
      <button
        class="inspector-tab"
        :class="{ active: activePanel === 'variables' }"
        @click="switchTab('variables')"
      >
        {{ $t('execution.variablesTabLabel') }}
        <span class="tab-count">{{ variableCount }}</span>
      </button>
    </div>

    <CardContent class="flex flex-1 flex-col gap-0 overflow-hidden p-0">
      <ScrollArea v-if="activePanel === 'console'" ref="chatEl" class="flex-1">
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

      <ScrollArea v-else-if="activePanel === 'variables'" class="flex-1">
        <div class="variables-panel">
          <Table v-if="variableCount > 0">
            <TableHeader>
              <TableRow>
                <TableHead class="h-8 text-xs">{{ $t('execution.varName') }}</TableHead>
                <TableHead class="h-8 text-xs">{{ $t('execution.varType') }}</TableHead>
                <TableHead class="h-8 text-xs">{{ $t('execution.varValue') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(v, i) in variables" :key="i">
                <TableCell class="py-2 text-xs font-mono">{{ v.name }}</TableCell>
                <TableCell class="py-2 text-xs text-muted-foreground">{{ v.type || '-' }}</TableCell>
                <TableCell class="py-2 text-xs font-mono">{{ formatValue(v.value) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div v-else class="empty-state">
            <span class="empty-title">{{ $t('execution.noVariablesShort') }}</span>
            <span class="empty-copy">{{ $t('execution.noVariablesDesc') }}</span>
          </div>
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

.inspector-tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg-toolbar);
}

.inspector-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  border-radius: 7px;
  background: var(--btn-ghost-bg);
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.inspector-tab:hover,
.inspector-tab.active {
  background: var(--bg-hover-strong);
  color: var(--text-primary);
}

.inspector-tab.active {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
}

.tab-count {
  display: inline-flex;
  min-width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  font-size: 10px;
}

.message-list,
.variables-panel {
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
