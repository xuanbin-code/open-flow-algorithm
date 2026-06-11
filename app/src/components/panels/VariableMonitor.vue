<script setup lang="ts">
import { ref, reactive, watch } from 'vue'

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
  variables: VariableEntry[]
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// ============================================================
// Draggable state
// ============================================================

const panelLeft = ref(window.innerWidth - 420)
const panelTop = ref(90)
const collapsed = ref(false)
const dragging = ref(false)
const hasDragged = ref(false)
let dragStartX = 0
let dragStartY = 0
let panelStartX = 0
let panelStartY = 0

function onDragStart(e: MouseEvent) {
  dragging.value = true
  hasDragged.value = false
  dragStartX = e.clientX
  dragStartY = e.clientY
  panelStartX = panelLeft.value
  panelStartY = panelTop.value
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: MouseEvent) {
  if (!dragging.value) return
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    hasDragged.value = true
  }
  panelLeft.value = panelStartX + dx
  panelTop.value = panelStartY + dy
}

function onDragEnd() {
  dragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

function onToggleClick() {
  if (hasDragged.value) return
  collapsed.value = !collapsed.value
}

// ============================================================
// Display helpers
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

// ============================================================
// Value animation state
// ============================================================

/** 动画过程中显示的中间值（key 为变量名） */
const displayedValues = reactive<Record<string, number>>({})

/** 正在播放动画的变量名集合 */
const animating = reactive(new Set<string>())

/** 活跃的 animation frame ID，用于中断重启 */
const activeAnims = new Map<string, number>()

function animateValue(name: string, from: number, to: number, duration = 300) {
  // 取消该变量正在进行的动画
  const existing = activeAnims.get(name)
  if (existing !== undefined) {
    cancelAnimationFrame(existing)
  }
  // 从当前 displayed 值重新起跳（避免跳变）
  const actualFrom = displayedValues[name] ?? from
  animating.add(name)
  displayedValues[name] = actualFrom

  const start = performance.now()
  const isInt = Number.isInteger(to) && Number.isInteger(from)

  function tick(now: number) {
    const elapsed = now - start
    const t = Math.min(elapsed / duration, 1)
    // ease-out
    const eased = 1 - (1 - t) * (1 - t)
    const current = actualFrom + (to - actualFrom) * eased
    displayedValues[name] = isInt ? Math.round(current) : current

    if (t < 1) {
      activeAnims.set(name, requestAnimationFrame(tick))
    } else {
      displayedValues[name] = to
      animating.delete(name)
      activeAnims.delete(name)
    }
  }

  activeAnims.set(name, requestAnimationFrame(tick))
}

function formatAnimated(name: string, v: { type: string }): string {
  const val = displayedValues[name]
  if (val === undefined || val === null) return '—'
  if (v.type === 'Real') {
    // 保留合理小数位
    return Number.isInteger(val) ? val + '.0' : String(Number(val.toFixed(6)))
  }
  return String(Math.round(val))
}

// ============================================================
// Watch: detect value changes and trigger animation
// ============================================================

watch(
  () => props.variables,
  (newVars) => {
    for (const v of newVars) {
      // 只处理 Integer 和 Real
      if (v.type !== 'Integer' && v.type !== 'Real') continue

      const newValue = Number(v.value)
      if (isNaN(newValue)) continue

      const prev = displayedValues[v.name]

      if (prev === undefined) {
        // 首次出现，只记录初始值，不触发动画
        displayedValues[v.name] = newValue
        continue
      }

      if (prev !== newValue) {
        animateValue(v.name, prev, newValue)
      }
    }
  },
)
</script>

<template>
  <div
    v-if="visible"
    class="var-monitor"
    :class="{ collapsed, dragging }"
    :style="{ left: panelLeft + 'px', top: panelTop + 'px' }"
  >
    <!-- Header bar (drag handle) -->
    <div
      class="monitor-header"
      @mousedown="onDragStart"
      @click="onToggleClick"
    >
      <span v-if="collapsed" class="collapsed-label">变量监视 ▸</span>
      <template v-else>
        <span class="drag-icon">⠿</span>
        <span class="monitor-title">变量监视</span>
        <span v-if="variables.length" class="var-count">({{ variables.length }})</span>
        <button class="close-btn" @click.stop="emit('close')" title="关闭">✕</button>
      </template>
    </div>

    <!-- Body (when expanded) -->
    <div v-if="!collapsed" class="monitor-body">
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
              <td class="var-value" :class="{ animating: animating.has(v.name) }">
                {{ animating.has(v.name) ? formatAnimated(v.name, v) : displayValue(v.value) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-hint">暂无变量</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.var-monitor {
  position: fixed;
  z-index: 1001;
  background: var(--bg-float-panel-95);
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  min-width: 260px;
  max-width: 400px;
  max-height: calc(100vh - 20px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  transition: box-shadow 0.2s ease;
  user-select: none;
}

.var-monitor.dragging {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
  transition: none;
}

.var-monitor.collapsed {
  background: var(--bg-float-collapsed);
}

/* ---- Header ---- */
.monitor-header {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  gap: 6px;
  cursor: grab;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-soft);
}

.monitor-header:active {
  cursor: grabbing;
}

.monitor-header.drag-handle {
  cursor: grab;
}
.monitor-header.drag-handle:active {
  cursor: grabbing;
}

.collapsed-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 2px 4px;
}

.drag-icon {
  font-size: 14px;
  color: var(--text-muted-2);
  letter-spacing: 2px;
}

.monitor-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.var-count {
  font-size: 10px;
  color: var(--text-muted-2);
}

.close-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-muted-2);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 3px;
  transition: background 0.15s, color 0.15s;
}
.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e74c3c;
}

/* ---- Body ---- */
.monitor-body {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.vars-scroll {
  overflow-y: auto;
  padding: 4px 8px;
  max-height: 360px;
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
  background: var(--bg-float-panel-95);
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
  transition: color 0.15s, font-weight 0.15s;
}

.var-value.animating {
  color: #2ecc71;
  font-weight: 700;
}

.empty-hint {
  color: var(--text-placeholder);
  font-style: italic;
  text-align: center;
  padding: 24px 0;
  font-size: 11px;
}

/* 滚动条 */
.vars-scroll::-webkit-scrollbar {
  width: 4px;
}
.vars-scroll::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 2px;
}
</style>
