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
// Chat auto-scroll
// ============================================================

const chatEl = ref<InstanceType<typeof ScrollArea> | null>(null)

watch(
  () => props.chatMessages.length,
  async () => {
    await nextTick()
    const viewport = chatEl.value?.$el?.querySelector('[data-scroll-area-viewport]')
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight
    }
  },
)

// ============================================================
// Input state
// ============================================================

const inputValue = ref('')
const hasInteracted = ref(false)
const activePanel = ref<'console' | 'variables' | 'history'>('console')

watch(
  () => props.executionStatus,
  async (status) => {
    if (status === 'waiting-input') {
      hasInteracted.value = false
      inputValue.value = ''
      await nextTick()
      const el = document.querySelector<HTMLInputElement>('[data-console-input]')
      el?.focus()
    }
  },
)

function onInputFocus() {
  hasInteracted.value = true
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
const historyItems = computed(() => props.chatMessages.filter(msg => msg.role !== 'system'))

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
        @click="activePanel = 'console'"
      >
        {{ $t('execution.consoleTab') }}
      </button>
      <button
        class="inspector-tab"
        :class="{ active: activePanel === 'variables' }"
        @click="activePanel = 'variables'"
      >
        {{ $t('execution.variablesTabLabel') }}
        <span class="tab-count">{{ variableCount }}</span>
      </button>
      <button
        class="inspector-tab"
        :class="{ active: activePanel === 'history' }"
        @click="activePanel = 'history'"
      >
        {{ $t('execution.historyTab') }}
      </button>
    </div>

    <CardContent class="flex flex-1 flex-col gap-0 overflow-hidden p-0">
      <ScrollArea v-if="activePanel === 'console'" ref="chatEl" class="flex-1">
        <div class="message-list">
          <div v-if="chatMessages.length === 0" class="empty-state">
            <span class="empty-title">{{ $t('execution.hintRunFirst') }}</span>
            <span class="empty-copy">{{ $t('execution.emptyHintDesc') }}</span>
          </div>
          <div
            v-for="(msg, i) in chatMessages"
            :key="i"
            class="chat-bubble"
            :class="[
              `bubble-${msg.role}`,
              { 'cursor-pointer hover:brightness-110': msg.role === 'program' && msg.sourceNodeId },
            ]"
            @click="msg.role === 'program' && msg.sourceNodeId && onOutputClick(msg.sourceNodeId)"
          >
            <span v-if="msg.role === 'program'" class="bubble-sender">{{ $t('execution.program') }}</span>
            <span v-else-if="msg.role === 'user'" class="bubble-sender">{{ $t('execution.you') }}</span>
            <span class="bubble-text">{{ msg.text }}</span>
          </div>
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

      <ScrollArea v-else class="flex-1">
        <div class="history-panel">
          <div v-if="historyItems.length === 0" class="empty-state">
            <span class="empty-title">{{ $t('execution.noStepsRecorded') }}</span>
            <span class="empty-copy">{{ $t('execution.noStepsDesc') }}</span>
          </div>
          <button
            v-for="(msg, i) in historyItems"
            :key="i"
            class="history-row"
            :class="`history-${msg.role}`"
            @click="msg.sourceNodeId && onOutputClick(msg.sourceNodeId)"
          >
            <span class="history-index">{{ i + 1 }}</span>
            <span class="history-role">{{ msg.role }}</span>
            <span class="history-text">{{ msg.text }}</span>
          </button>
        </div>
      </ScrollArea>

      <div
        class="chat-input-bar"
        :class="{
          'opacity-50': executionStatus !== 'waiting-input',
          'animate-pulse': executionStatus === 'waiting-input' && !hasInteracted,
        }"
      >
        <Input
          v-model="inputValue"
          data-console-input
          class="flex-1"
          :class="{ 'ring-2 ring-ring': executionStatus === 'waiting-input' && !hasInteracted }"
          :placeholder="
            executionStatus === 'waiting-input'
              ? $t('execution.inputPlaceholder', { name: variableName })
              : $t('execution.waitingForRun')
          "
          :disabled="executionStatus !== 'waiting-input'"
          @focus="onInputFocus"
          @keydown="onInputKeydown"
        />
        <Button
          class="send-btn"
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
  grid-template-columns: repeat(3, 1fr);
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
.variables-panel,
.history-panel {
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

.history-row {
  display: grid;
  grid-template-columns: 28px 64px 1fr;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px 8px;
  text-align: left;
}

.history-row:hover {
  background: var(--bg-hover);
}

.history-index {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
}

.history-role {
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.history-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

/* Input bar */
.chat-input-bar {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--border-soft);
  flex-shrink: 0;
  transition: opacity 0.25s ease;
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
