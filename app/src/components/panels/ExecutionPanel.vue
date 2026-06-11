<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { GripVertical } from '../icons'

// ============================================================
// Types
// ============================================================

export interface VariableEntry {
  name: string
  type: string
  value: unknown
}

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  output: string[]
  variables: VariableEntry[]
  visible: boolean
  executionStatus: 'idle' | 'running' | 'paused' | 'waiting-input' | 'stopped'
  initialPosition?: { x: number; y: number }
}>()

const emit = defineEmits<{
  clear: []
}>()

// ============================================================
// Draggable state
// ============================================================

const offsetX = ref(props.initialPosition?.x ?? window.innerWidth - 380)
const offsetY = ref(props.initialPosition?.y ?? 60)
const dragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let panelStartX = 0
let panelStartY = 0

function onDragStart(e: MouseEvent) {
  dragging.value = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  panelStartX = offsetX.value
  panelStartY = offsetY.value
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: MouseEvent) {
  if (!dragging.value) return
  offsetX.value = panelStartX + (e.clientX - dragStartX)
  offsetY.value = panelStartY + (e.clientY - dragStartY)
}

function onDragEnd() {
  dragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

// ============================================================
// Console auto-scroll
// ============================================================

const consoleEl = ref<HTMLElement | null>(null)

watch(
  () => props.output.length,
  async () => {
    await nextTick()
    if (consoleEl.value) {
      consoleEl.value.scrollTop = consoleEl.value.scrollHeight
    }
  },
)

// ============================================================
// Tab state
// ============================================================

const activeTab = ref<'console' | 'variables'>('console')

// ============================================================
// Status label
// ============================================================

const STATUS_LABELS: Record<string, string> = {
  idle: '就绪',
  running: '运行中...',
  paused: '已暂停',
  'waiting-input': '等待输入',
  stopped: '已终止',
}

const STATUS_COLORS: Record<string, string> = {
  idle: '#888',
  running: '#2ecc71',
  paused: '#f39c12',
  'waiting-input': '#3498db',
  stopped: '#e74c3c',
}

// ============================================================
// Value display helper
// ============================================================

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '(空)'
  if (typeof value === 'boolean') return value ? '真' : '假'
  if (typeof value === 'number') {
    // 整数不显示小数点
    return Number.isInteger(value) ? String(value) : String(value)
  }
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
  <div
    v-if="visible"
    class="exec-panel"
    :style="{ left: offsetX + 'px', top: offsetY + 'px' }"
  >
    <!-- Header (drag handle) -->
    <div class="panel-header" @mousedown="onDragStart">
      <GripVertical class="drag-icon" :size="14" />
      <span class="panel-title">运行时</span>
      <span class="status-badge" :style="{ background: STATUS_COLORS[executionStatus] }">
        {{ STATUS_LABELS[executionStatus] ?? executionStatus }}
      </span>
      <button class="clear-btn" title="清空控制台" @click="emit('clear')">清空</button>
    </div>

    <!-- Tab bar -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'console' }"
        @click="activeTab = 'console'"
      >
        控制台
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'variables' }"
        @click="activeTab = 'variables'"
      >
        变量 ({{ variables.length }})
      </button>
    </div>

    <!-- Body -->
    <div class="panel-body">
      <!-- Console tab -->
      <div v-if="activeTab === 'console'" ref="consoleEl" class="console-output">
        <div v-if="output.length === 0" class="console-placeholder">
          程序尚未运行。点击「程序 → 运行」开始执行。
        </div>
        <div v-for="(line, i) in output" :key="i" class="console-line">{{ line }}</div>
      </div>

      <!-- Variables tab -->
      <div v-if="activeTab === 'variables'" class="variables-view">
        <table v-if="variables.length > 0" class="var-table">
          <thead>
            <tr>
              <th>变量名</th>
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
        <div v-else class="console-placeholder">
          暂无变量。程序运行后将在此显示所有变量。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exec-panel {
  position: fixed;
  z-index: 9990;
  background: rgba(22, 22, 42, 0.97);
  border: 1px solid #444;
  border-radius: 10px;
  color: #ccc;
  font-size: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  width: 320px;
  max-height: 460px;
  display: flex;
  flex-direction: column;
  user-select: none;
}

/* ---- Header ---- */
.panel-header {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  cursor: grab;
  border-bottom: 1px solid #333;
  gap: 8px;
  flex-shrink: 0;
}
.panel-header:active {
  cursor: grabbing;
}
.drag-icon {
  color: #666;
  cursor: grab;
  flex-shrink: 0;
}
.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #eee;
}
.status-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  margin-left: auto;
}
.clear-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid #555;
  color: #aaa;
  cursor: pointer;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}
.clear-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

/* ---- Tab bar ---- */
.tab-bar {
  display: flex;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}
.tab-btn {
  flex: 1;
  padding: 6px 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #888;
  cursor: pointer;
  font-size: 12px;
  transition: color 0.15s, border-color 0.15s;
}
.tab-btn:hover {
  color: #ccc;
}
.tab-btn.active {
  color: #4fc3f7;
  border-bottom-color: #4fc3f7;
}

/* ---- Body ---- */
.panel-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ---- Console ---- */
.console-output {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  background: rgba(0, 0, 0, 0.35);
  min-height: 100px;
  max-height: 200px;
}

.console-placeholder {
  color: #555;
  font-style: italic;
  padding: 16px 0;
  text-align: center;
  font-family: inherit;
  font-size: 11px;
  white-space: pre-line;
}

.console-line {
  color: #ddd;
  white-space: pre-wrap;
  word-break: break-all;
}

/* ---- Variables ---- */
.variables-view {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
  max-height: 240px;
}

.var-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.var-table th {
  text-align: left;
  padding: 5px 8px;
  color: #888;
  font-weight: 500;
  border-bottom: 1px solid #333;
  position: sticky;
  top: 0;
  background: rgba(22, 22, 42, 0.97);
}

.var-table td {
  padding: 4px 8px;
  border-bottom: 1px solid #2a2a3a;
}

.var-name {
  color: #4fc3f7;
  font-weight: 600;
}

.var-type {
  color: #888;
}

.var-value {
  color: #2ecc71;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  word-break: break-all;
  max-width: 140px;
}
</style>
