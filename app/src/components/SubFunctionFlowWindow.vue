<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import type { FlowNode, FlowEdge } from '../engine/flowchart-engine'
import StartNode from './nodes/StartNode.vue'
import EndNode from './nodes/EndNode.vue'
import DeclareNode from './nodes/DeclareNode.vue'
import AssignNode from './nodes/AssignNode.vue'
import InputNode from './nodes/InputNode.vue'
import OutputNode from './nodes/OutputNode.vue'
import IfNode from './nodes/IfNode.vue'
import MergeNode from './nodes/MergeNode.vue'
import ForNode from './nodes/ForNode.vue'
import WhileNode from './nodes/WhileNode.vue'
import CallNode from './nodes/CallNode.vue'
import { X } from './icons'

// ============================================================
// Types (also used by App.vue)
// ============================================================

export interface SubWindowState {
  funcName: string
  instanceId: number
  nodes: FlowNode[]
  edges: FlowEdge[]
  executingNodeIds: string[]
  previousNodeId: string | null
  visible: boolean
  left: number
  top: number
}

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  windowState: SubWindowState
}>()

const emit = defineEmits<{
  close: []
}>()

// ============================================================
// VueFlow access — 必须使用唯一 id 避免与主 VueFlow 共享 store
// ============================================================

const flowId = computed(() => `sub-${props.windowState.funcName}-${props.windowState.instanceId}`)
const { updateNodeData } = useVueFlow({ id: flowId.value })

// ============================================================
// Execution highlight sync
// ============================================================

const lastHighlightedIds = ref<Set<string>>(new Set())

watch(
  () => [...props.windowState.executingNodeIds],
  (newIds) => {
    const newSet = new Set(newIds)
    const prevSet = lastHighlightedIds.value

    // Highlight newly executing nodes
    for (const id of newSet) {
      if (!prevSet.has(id)) {
        updateNodeData(id, { executing: true })
      }
    }

    // Un-highlight nodes that are no longer executing
    for (const id of prevSet) {
      if (!newSet.has(id)) {
        updateNodeData(id, { executing: false })
      }
    }

    lastHighlightedIds.value = newSet
  },
)

/** Reset all highlights when window is closed or unmounted */
function resetAllHighlights() {
  for (const id of lastHighlightedIds.value) {
    updateNodeData(id, { executing: false })
  }
  lastHighlightedIds.value = new Set()
}

onUnmounted(() => {
  resetAllHighlights()
})

// ============================================================
// Draggable state & handlers (adapted from VariableMonitor)
// ============================================================

const dragging = ref(false)
const hasDragged = ref(false)
let dragStartX = 0
let dragStartY = 0
let winStartLeft = 0
let winStartTop = 0

function onDragStart(e: MouseEvent) {
  dragging.value = true
  hasDragged.value = false
  dragStartX = e.clientX
  dragStartY = e.clientY
  winStartLeft = props.windowState.left
  winStartTop = props.windowState.top
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
  props.windowState.left = winStartLeft + dx
  props.windowState.top = winStartTop + dy
}

function onDragEnd() {
  dragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

function onClose() {
  resetAllHighlights()
  emit('close')
}
</script>

<template>
  <div
    v-if="props.windowState.visible"
    class="sub-fn-window"
    :class="{ dragging }"
    :style="{
      left: props.windowState.left + 'px',
      top: props.windowState.top + 'px',
    }"
  >
    <!-- Title bar -->
    <div class="sub-fn-titlebar" @mousedown="onDragStart">
      <span class="sub-fn-title">{{ props.windowState.funcName }}</span>
      <button class="sub-fn-close" @click.stop="onClose" :title="'Close'">
        <X :size="15" />
      </button>
    </div>

    <!-- VueFlow -->
    <div class="sub-fn-flow">
      <VueFlow
        :id="flowId"
        :nodes="props.windowState.nodes"
        :edges="props.windowState.edges"
        :default-viewport="{ zoom: 0.8, x: 0, y: 0 }"
        :min-zoom="0.1"
        :max-zoom="4"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :elements-selectable="false"
        :zoom-on-scroll="true"
        :pan-on-scroll="false"
        :pan-on-drag="true"
        fit-view-on-init
      >
        <Background pattern-color="#aaa" :gap="20" />
        <template #node-start="nodeProps">
          <StartNode v-bind="nodeProps" />
        </template>
        <template #node-end="nodeProps">
          <EndNode v-bind="nodeProps" />
        </template>
        <template #node-default="nodeProps">
          <div
            class="default-node-fallback"
            :class="{ 'is-empty': nodeProps.data?.isEmpty }"
            :style="{
              width: (nodeProps.data?.width ?? 120) + 'px',
              height: (nodeProps.data?.height ?? 50) + 'px',
            }"
          >
            {{ nodeProps.data?.label ?? '' }}
          </div>
        </template>
        <template #node-declare="nodeProps">
          <DeclareNode v-bind="nodeProps" />
        </template>
        <template #node-assign="nodeProps">
          <AssignNode v-bind="nodeProps" />
        </template>
        <template #node-fg-input="nodeProps">
          <InputNode v-bind="nodeProps" />
        </template>
        <template #node-fg-output="nodeProps">
          <OutputNode v-bind="nodeProps" />
        </template>
        <template #node-fg-if="nodeProps">
          <IfNode v-bind="nodeProps" />
        </template>
        <template #node-fg-merge="nodeProps">
          <MergeNode v-bind="nodeProps" />
        </template>
        <template #node-fg-for="nodeProps">
          <ForNode v-bind="nodeProps" />
        </template>
        <template #node-fg-while="nodeProps">
          <WhileNode v-bind="nodeProps" />
        </template>
        <template #node-call="nodeProps">
          <CallNode v-bind="nodeProps" />
        </template>
      </VueFlow>
    </div>
  </div>
</template>

<style scoped>
.sub-fn-window {
  position: fixed;
  z-index: 50;
  width: 420px;
  height: 380px;
  background: var(--bg-panel);
  border: 1px solid var(--border-medium);
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: opacity 0.15s ease;
}

.sub-fn-window.dragging {
  opacity: 0.92;
}

.sub-fn-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--bg-rail);
  border-bottom: 1px solid var(--border-soft);
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
}

.sub-fn-titlebar:active {
  cursor: grabbing;
}

.sub-fn-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
}

.sub-fn-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
}

.sub-fn-close:hover {
  color: var(--text-foreground);
  background: hsl(var(--foreground) / 0.1);
}

.sub-fn-flow {
  flex: 1;
  min-height: 0;
}

.default-node-fallback {
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--text-muted);
}

.default-node-fallback.is-empty {
  border-style: dashed;
  opacity: 0.6;
}
</style>
