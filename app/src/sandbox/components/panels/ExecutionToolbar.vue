<script setup lang="ts">
import { computed } from 'vue'

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  executionStatus: 'idle' | 'running' | 'paused' | 'waiting-input' | 'stopped'
  executionSpeed: 'slow' | 'normal' | 'fast'
}>()

const emit = defineEmits<{
  run: []
  step: []
  pause: []
  resume: []
  stop: []
  setSpeed: [speed: 'slow' | 'normal' | 'fast']
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
      <svg width="14" height="14" viewBox="0 0 14 14">
        <path d="M3,1 L13,7 L3,13 Z" fill="currentColor" />
      </svg>
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
      <svg width="14" height="14" viewBox="0 0 14 14">
        <rect x="2" y="1" width="3" height="12" rx="0.5" fill="currentColor" />
        <path d="M8,1 L14,7 L8,13 Z" fill="currentColor" />
      </svg>
      <span>{{ stepLabel }}</span>
    </button>

    <!-- Pause / Resume -->
    <button
      class="tb-btn"
      :title="isPaused ? '继续运行' : '暂停'"
      :disabled="!canPause && !isPaused"
      @click="onPauseClick"
    >
      <!-- Pause icon: two vertical bars -->
      <svg v-if="!isPaused" width="14" height="14" viewBox="0 0 14 14">
        <rect x="2" y="1" width="4" height="12" rx="0.5" fill="currentColor" />
        <rect x="8" y="1" width="4" height="12" rx="0.5" fill="currentColor" />
      </svg>
      <!-- Resume icon: triangle (same as run) -->
      <svg v-else width="14" height="14" viewBox="0 0 14 14">
        <path d="M3,1 L13,7 L3,13 Z" fill="currentColor" />
      </svg>
      <span>{{ isPaused ? '继续' : '暂停' }}</span>
    </button>

    <!-- Stop -->
    <button
      class="tb-btn"
      title="停止"
      :disabled="!canStop"
      @click="emit('stop')"
    >
      <svg width="14" height="14" viewBox="0 0 14 14">
        <rect x="2" y="2" width="10" height="10" rx="1.5" fill="currentColor" />
      </svg>
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
  </div>
</template>

<style scoped>
.exec-toolbar {
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 8px;
  background: #12122a;
  border-bottom: 1px solid #2a2a3e;
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
  color: #bbb;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.tb-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.tb-btn:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}
.tb-btn:disabled {
  color: #444;
  cursor: not-allowed;
}
.tb-btn:disabled svg {
  opacity: 0.35;
}

/* ---- Separator ---- */
.tb-sep {
  width: 1px;
  height: 16px;
  background: #2a2a3e;
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
  color: #666;
  margin-right: 4px;
}
.speed-btn {
  height: 22px;
  padding: 0 8px;
  background: transparent;
  border: 1px solid #333;
  border-radius: 3px;
  color: #888;
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.speed-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #bbb;
}
.speed-btn.active {
  background: rgba(52, 152, 219, 0.2);
  border-color: #3498db;
  color: #4fc3f7;
  font-weight: 600;
}
</style>
