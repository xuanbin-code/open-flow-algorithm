<script setup lang="ts">
import { ref, computed } from 'vue'

// ============================================================
// Types
// ============================================================

interface InsertableNode {
  type: string
  label: string
  category: string
  bg: string
  border: string
  shape: 'rect' | 'parallelogram' | 'diamond' | 'hexagon'
}

interface Category {
  name: string
  nodes: InsertableNode[]
}

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  position: { x: number; y: number }
}>()

const emit = defineEmits<{
  close: []
  insert: [type: string]
}>()

// ============================================================
// Draggable state
// ============================================================

const offsetX = ref(props.position.x)
const offsetY = ref(props.position.y)
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
// Node data
// ============================================================

const categories: Category[] = [
  {
    name: '输入/输出',
    nodes: [
      { type: 'input',  label: '输入',  category: '输入/输出', bg: '#e67e22', border: '#d35400', shape: 'parallelogram' },
      { type: 'output', label: '输出',  category: '输入/输出', bg: '#1abc9c', border: '#16a085', shape: 'parallelogram' },
    ],
  },
  {
    name: '变量',
    nodes: [
      { type: 'declare', label: '声明', category: '变量', bg: '#3498db', border: '#2980b9', shape: 'rect' },
      { type: 'assign',  label: '赋值', category: '变量', bg: '#9b59b6', border: '#8e44ad', shape: 'rect' },
    ],
  },
  {
    name: '控制',
    nodes: [
      { type: 'if', label: '判断', category: '控制', bg: '#f39c12', border: '#e67e22', shape: 'diamond' },
    ],
  },
  {
    name: '循环',
    nodes: [
      { type: 'for',   label: 'for 循环',   category: '循环', bg: '#2ecc71', border: '#27ae60', shape: 'hexagon' },
      { type: 'while', label: 'while 循环', category: '循环', bg: '#f1c40f', border: '#d4ac0d', shape: 'diamond' },
      { type: 'do',    label: 'do 循环',    category: '循环', bg: '#e74c3c', border: '#c0392b', shape: 'diamond' },
    ],
  },
]

// ============================================================
// Node button shape style
// ============================================================

function nodeStyle(n: InsertableNode): Record<string, string> {
  const base: Record<string, string> = {
    background: n.bg,
    borderColor: n.border,
  }
  switch (n.shape) {
    case 'parallelogram':
      base.transform = 'skewX(-10deg)'
      base.borderRadius = '3px'
      break
    case 'diamond':
      base.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
      break
    case 'hexagon':
      base.clipPath = 'polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%)'
      break
    default:
      base.borderRadius = '4px'
  }
  return base
}

function labelStyle(n: InsertableNode): Record<string, string> {
  if (n.shape === 'parallelogram') {
    return { transform: 'skewX(10deg)' }
  }
  return {}
}
</script>

<template>
  <!-- 透明遮罩：点击关闭 -->
  <div class="insert-mask" @mousedown.self="emit('close')">
    <div
      class="insert-panel"
      :style="{ left: offsetX + 'px', top: offsetY + 'px' }"
    >
      <!-- Header (drag handle) -->
      <div class="panel-header" @mousedown="onDragStart">
        <span class="drag-icon">⠿</span>
        <span class="panel-title">插入节点</span>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <!-- Body: categorized grid -->
      <div class="panel-body">
        <div v-for="cat in categories" :key="cat.name" class="category-col">
          <div class="category-name">{{ cat.name }}</div>
          <button
            v-for="node in cat.nodes"
            :key="node.type"
            class="node-btn"
            :style="nodeStyle(node)"
            @click="emit('insert', node.type)"
          >
            <span class="node-btn-label" :style="labelStyle(node)">{{ node.label }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.insert-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: transparent;
}

.insert-panel {
  position: fixed;
  z-index: 9999;
  background: rgba(30, 30, 50, 0.97);
  border: 1px solid #555;
  border-radius: 10px;
  color: #ccc;
  font-size: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  min-width: 340px;
  user-select: none;
}

/* ---- Header ---- */
.panel-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: grab;
  border-bottom: 1px solid #444;
  gap: 8px;
}
.panel-header:active {
  cursor: grabbing;
}
.drag-icon {
  font-size: 14px;
  color: #888;
  cursor: grab;
}
.panel-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #eee;
}
.close-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 3px;
  transition: color 0.15s, background 0.15s;
}
.close-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

/* ---- Body ---- */
.panel-body {
  display: flex;
  padding: 12px;
  gap: 12px;
}

.category-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.category-name {
  font-size: 11px;
  color: #888;
  text-align: center;
  padding-bottom: 4px;
  border-bottom: 1px solid #333;
  white-space: nowrap;
}

/* ---- Node buttons ---- */
.node-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 40px;
  border: 2px solid;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  transition: filter 0.15s, transform 0.15s;
  align-self: center;
}
.node-btn:hover {
  filter: brightness(1.3);
  transform: scale(1.05);
}
.node-btn:active {
  transform: scale(0.95);
}

.node-btn-label {
  white-space: nowrap;
  pointer-events: none;
}
</style>
