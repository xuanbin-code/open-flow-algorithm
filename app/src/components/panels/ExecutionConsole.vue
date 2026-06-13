<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

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
</script>

<template>
  <Card class="exec-console flex h-full flex-col rounded-none border-0 border-l">
    <!-- Header -->
    <CardHeader class="flex-row items-center gap-2 space-y-0 px-3 py-2">
      <CardTitle class="text-sm font-semibold">
        {{ $t('execution.title') }}
      </CardTitle>
      <Badge :variant="STATUS_VARIANTS[executionStatus] ?? 'secondary'" class="text-[10px]">
        {{ STATUS_LABELS[executionStatus] ?? executionStatus }}
      </Badge>
      <Button variant="ghost" size="xs" class="ml-auto text-xs" @click="emit('clear')">
        {{ $t('execution.clear') }}
      </Button>
    </CardHeader>

    <CardContent class="flex flex-1 flex-col gap-0 overflow-hidden p-0">
      <!-- Chat messages -->
      <ScrollArea ref="chatEl" class="flex-1">
        <div class="flex flex-col gap-2 p-2">
          <div v-if="chatMessages.length === 0" class="py-6 text-center text-xs italic text-muted-foreground">
            {{ $t('execution.hintRunFirst') }}
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

      <!-- Input bar -->
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

/* Input bar */
.chat-input-bar {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--border-soft);
  flex-shrink: 0;
  transition: opacity 0.25s ease;
}
</style>
