<script setup lang="ts">
import { computed } from 'vue'
import { Play, StepForward, Pause, Square, Table } from '../icons'

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  executionStatus: 'idle' | 'running' | 'paused' | 'waiting-input' | 'stopped'
  executionSpeed: 'slow' | 'normal' | 'fast'
  showVariableMonitor: boolean
}>()

const emit = defineEmits<{
  run: []
  step: []
  pause: []
  resume: []
  stop: []
  setSpeed: [speed: 'slow' | 'normal' | 'fast']
  toggleVariableMonitor: []
}>()

// ============================================================
// Button state computed
// ============================================================

const canRun = computed(() =>
  props.executionStatus === 'idle' || props.executionStatus === 'stopped',
)
const canStep = computed(() =>
  props.executionStatus === 'idle' || props.executionStatus === 'stopped' || props.executionStatus === 'paused',
)
const canPause = computed(() =>
  props.executionStatus === 'running',
)
const canStop = computed(() =>
  props.executionStatus === 'running' || props.executionStatus === 'paused' || props.executionStatus === 'waiting-input',
)

// 步进按钮在 paused 状态下文案改为"继续"
const stepLabel = computed(() =>
  props.executionStatus === 'paused' ? '继续' : '步进',
)

// 暂停按钮在 paused 状态下变为"继续运行"（waiting-input 不在此列，需通过控制台输入）
const isPaused = computed(() =>
  props.executionStatus === 'paused',
)

function onPauseClick() {
  if (isPaused.value) {
    emit('resume')
  } else {
    emit('pause')
  }
}

// ============================================================
// Speed options
// ============================================================

const SPEEDS: Array<{ id: 'slow' | 'normal' | 'fast'; label: string }> = [
  { id: 'slow', label: '慢' },
  { id: 'normal', label: '常' },
  { id: 'fast', label: '快' },
]
</script>

<template>
  <div class="exec-toolbar">
    <!-- Run -->
    <button
      class="tb-btn"
      title="运行"
      :disabled="!canRun"
      @click="emit('run')"
    >
      <Play :size="14" />
      <span>运行</span>
    </button>

    <div class="tb-sep" />

    <!-- Step -->
    <button
      class="tb-btn"
      :title="stepLabel"
      :disabled="!canStep"
      @click="emit('step')"
    >
      <StepForward :size="14" />
      <span>{{ stepLabel }}</span>
    </button>

    <!-- Pause / Resume -->
    <button
      class="tb-btn"
      :title="isPaused ? '继续运行' : '暂停'"
      :disabled="!canPause && !isPaused"
      @click="onPauseClick"
    >
      <Pause v-if="!isPaused" :size="14" />
      <Play v-else :size="14" />
      <span>{{ isPaused ? '继续' : '暂停' }}</span>
    </button>

    <!-- Stop -->
    <button
      class="tb-btn"
      title="停止"
      :disabled="!canStop"
      @click="emit('stop')"
    >
      <Square :size="14" />
      <span>停止</span>
    </button>

    <!-- Spacer -->
    <div class="tb-spacer" />

    <!-- Speed selector -->
    <div class="tb-speed-group">
      <span class="speed-label">速度</span>
      <button
        v-for="s in SPEEDS"
        :key="s.id"
        class="speed-btn"
        :class="{ active: executionSpeed === s.id }"
        @click="emit('setSpeed', s.id)"
      >
        {{ s.label }}
      </button>
    </div>

    <div class="tb-sep" />

    <!-- Variable monitor toggle -->
    <button
      class="tb-btn"
      :title="showVariableMonitor ? '隐藏变量监视' : '显示变量监视'"
      @click="emit('toggleVariableMonitor')"
    >
      <Table :size="14" />
      <span v-if="showVariableMonitor">变量</span>
    </button>
  </div>
</template>

<style scoped>
.exec-toolbar {
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 8px;
  background: var(--bg-toolbar);
  border-bottom: 1px solid var(--border-soft);
  gap: 2px;
  flex-shrink: 0;
}

/* ---- Buttons ---- */
.tb-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--text-dim);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.tb-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.tb-btn:active:not(:disabled) {
  background: var(--bg-hover-strong);
}
.tb-btn:disabled {
  color: var(--border-medium);
  cursor: not-allowed;
}
.tb-btn:disabled svg {
  opacity: 0.35;
}

/* ---- Separator ---- */
.tb-sep {
  width: 1px;
  height: 16px;
  background: var(--border-soft);
  margin: 0 4px;
  flex-shrink: 0;
}

/* ---- Spacer ---- */
.tb-spacer {
  flex: 1;
}

/* ---- Speed ---- */
.tb-speed-group {
  display: flex;
  align-items: center;
  gap: 2px;
}
.speed-label {
  font-size: 10px;
  color: var(--text-disabled);
  margin-right: 4px;
}
.speed-btn {
  height: 22px;
  padding: 0 8px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  color: var(--text-muted-2);
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.speed-btn:hover {
  background: var(--bg-hover);
  color: var(--text-dim);
}
.speed-btn.active {
  background: var(--bg-speed-active);
  border-color: var(--accent-blue);
  color: var(--accent);
  font-weight: 600;
}
</style>
