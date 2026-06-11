<script setup lang="ts">
import { ref, computed } from 'vue'
import { Ruler, Eye, ChevronLeft, ChevronRight } from '../icons'

export interface ParamDef {
  key: string
  label: string
  min: number
  max: number
  step: number
}

const props = defineProps<{
  params: Record<string, number>
  definitions: ParamDef[]
  vpZoom: number
  vpX: number
  vpY: number
}>()

const emit = defineEmits<{
  'update:vpZoom': [value: number]
  'update:vpX': [value: number]
  'update:vpY': [value: number]
}>()

const collapsed = ref(true)

// ============================================================
// Draggable state
// ============================================================

const panelLeft = ref(window.innerWidth - 60)
const panelTop = ref(10)
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

// 分组
const groups = computed(() => {
  const spacing: ParamDef[] = []
  const nodeSize: ParamDef[] = []
  const branch: ParamDef[] = []
  const other: ParamDef[] = []

  for (const d of props.definitions) {
    if (d.key.includes('SPACING') || d.key.includes('START_Y') || d.key.includes('CENTER')) {
      spacing.push(d)
    } else if (d.key.includes('NODE_H') || d.key.includes('NODE_MIN_W') || d.key.includes('NODE_W') || d.key.includes('START_W') || d.key.includes('END_H') || d.key.includes('MERGE')) {
      nodeSize.push(d)
    } else if (d.key.includes('BRANCH') || d.key.includes('GAP')) {
      branch.push(d)
    } else {
      other.push(d)
    }
  }

  return [
    { name: '间距', list: spacing },
    { name: '节点尺寸', list: nodeSize },
    { name: '分支间距', list: branch },
    ...(other.length ? [{ name: '其他', list: other }] : []),
  ].filter(g => g.list.length > 0)
})
</script>

<template>
  <div
    class="debug-panel"
    :class="{ collapsed, dragging }"
    :style="{ left: panelLeft + 'px', top: panelTop + 'px' }"
  >
    <button
      class="toggle-btn"
      :class="{ 'drag-handle': collapsed }"
      @mousedown="collapsed && onDragStart($event)"
      @click="onToggleClick"
    >
      <ChevronRight v-if="collapsed" :size="14" />
      <span v-if="collapsed">调试</span>
      <span v-else>调试</span>
      <ChevronLeft v-if="!collapsed" :size="14" />
    </button>

    <div v-if="!collapsed" class="panel-body">
      <div class="panel-header" @mousedown="onDragStart">
        <h3><Ruler :size="16" class="section-icon" /> 布局参数</h3>
      </div>

      <div v-for="group in groups" :key="group.name" class="param-group">
        <h4 class="group-title">{{ group.name }}</h4>
        <div v-for="def in group.list" :key="def.key" class="param-row">
          <label class="param-label">{{ def.label }}</label>
          <div class="param-controls">
            <input
              type="range"
              class="param-slider"
              :min="def.min"
              :max="def.max"
              :step="def.step"
              :value="props.params[def.key]"
              @input="(e: Event) => { props.params[def.key] = Number((e.target as HTMLInputElement).value) }"
            />
            <input
              type="number"
              class="param-input"
              :min="def.min"
              :max="def.max"
              :step="def.step"
              :value="props.params[def.key]"
              @input="(e: Event) => { props.params[def.key] = Number((e.target as HTMLInputElement).value) }"
            />
          </div>
        </div>
      </div>

      <!-- 视图参数（不影响 nodes/edges，仅调视口） -->
      <div class="viewport-separator" />
      <div class="param-group">
        <h4 class="group-title viewport-title"><Eye :size="14" class="section-icon" /> 视图（不重绘）</h4>
        <div class="param-row">
          <label class="param-label">缩放 Zoom</label>
          <div class="param-controls">
            <input
              type="range"
              class="param-slider"
              min="0.1"
              max="4"
              step="0.1"
              :value="props.vpZoom"
              @input="(e: Event) => { emit('update:vpZoom', Number((e.target as HTMLInputElement).value)) }"
            />
            <input
              type="number"
              class="param-input"
              min="0.1"
              max="4"
              step="0.1"
              :value="props.vpZoom"
              @input="(e: Event) => { emit('update:vpZoom', Number((e.target as HTMLInputElement).value)) }"
            />
          </div>
        </div>
        <div class="param-row">
          <label class="param-label">视口 X</label>
          <div class="param-controls">
            <input
              type="range"
              class="param-slider"
              min="-500"
              max="2000"
              step="10"
              :value="props.vpX"
              @input="(e: Event) => { emit('update:vpX', Number((e.target as HTMLInputElement).value)) }"
            />
            <input
              type="number"
              class="param-input"
              min="-500"
              max="2000"
              step="10"
              :value="props.vpX"
              @input="(e: Event) => { emit('update:vpX', Number((e.target as HTMLInputElement).value)) }"
            />
          </div>
        </div>
        <div class="param-row">
          <label class="param-label">视口 Y</label>
          <div class="param-controls">
            <input
              type="range"
              class="param-slider"
              min="-500"
              max="2000"
              step="10"
              :value="props.vpY"
              @input="(e: Event) => { emit('update:vpY', Number((e.target as HTMLInputElement).value)) }"
            />
            <input
              type="number"
              class="param-input"
              min="-500"
              max="2000"
              step="10"
              :value="props.vpY"
              @input="(e: Event) => { emit('update:vpY', Number((e.target as HTMLInputElement).value)) }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.debug-panel {
  position: fixed;
  z-index: 1000;
  background: var(--bg-float-panel-95);
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  max-height: calc(100vh - 20px);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-debug);
  backdrop-filter: blur(8px);
  transition: box-shadow 0.2s ease;
  user-select: none;
}

.debug-panel.dragging {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
  transition: none;
}

.debug-panel.collapsed {
  background: var(--bg-float-collapsed);
}

.toggle-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--bg-toggle-btn);
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  border-radius: 8px;
  white-space: nowrap;
  transition: background 0.15s;
}
.toggle-btn.drag-handle {
  cursor: grab;
}
.toggle-btn.drag-handle:active {
  cursor: grabbing;
}
.toggle-btn:hover {
  background: var(--bg-toggle-btn-hover);
}

.panel-header {
  cursor: grab;
}
.panel-header:active {
  cursor: grabbing;
}

.panel-body {
  overflow-y: auto;
  padding: 0 12px 12px;
  max-height: calc(100vh - 60px);
}

.panel-header h3 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 4px;
  font-size: 14px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-medium);
  padding-bottom: 6px;
}

.section-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.param-group {
  margin-top: 8px;
}

.group-title {
  margin: 4px 0;
  font-size: 11px;
  color: var(--text-muted-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.param-row {
  margin: 4px 0;
}

.param-label {
  display: block;
  margin-bottom: 2px;
  color: var(--text-muted-2);
  font-size: 11px;
}

.param-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.param-slider {
  flex: 1;
  height: 4px;
  accent-color: var(--accent);
  cursor: pointer;
}

.param-input {
  width: 52px;
  padding: 2px 4px;
  background: var(--border-soft);
  border: 1px solid var(--dialog-border);
  border-radius: 3px;
  color: var(--text-primary);
  font-size: 11px;
  text-align: right;
}
.param-input:focus {
  outline: none;
  border-color: var(--accent);
}

/* ---- Viewport separator ---- */
.viewport-separator {
  height: 1px;
  margin: 10px 0 6px;
  background: var(--border-medium);
}
.viewport-title {
  color: var(--accent) !important;
}

/* 滚动条 */
.panel-body::-webkit-scrollbar {
  width: 4px;
}
.panel-body::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 2px;
}
</style>
