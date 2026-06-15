<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { VueFlow, useVueFlow, Panel } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import type { FlowNode, FlowEdge } from '../engine/flowchart-engine'
import type { VariableEntry } from '@/types'
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
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { X } from '@/lib/icons'
import { ChevronDown, ChevronRight } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { TooltipProvider } from '@/components/ui/tooltip'

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
  variables: VariableEntry[]
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

const flowId = computed(
  () => `sub-${props.windowState.funcName}-${props.windowState.instanceId}`,
)
const { updateNodeData, fitView } = useVueFlow({ id: flowId.value })

// ============================================================
// Execution highlight sync
// ============================================================

const lastHighlightedIds = ref<Set<string>>(new Set())

watch(
  () => [...props.windowState.executingNodeIds],
  newIds => {
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

// 手动调用 fitView：等所有节点完成 DOM 渲染和尺寸测量后再适配视口
// 避免 fit-view-on-init 在节点未就绪时基于不完整数据计算视口导致 edge 偏移
onMounted(async () => {
  await nextTick()
  // 再等一帧，确保 VueFlow 内部完成节点尺寸测量（ResizeObserver）
  await new Promise(resolve => requestAnimationFrame(resolve))
  fitView({ padding: 0.1, duration: 0 })
})

// ============================================================
// Executing state — drives the flowing border animation
// ============================================================

const isExecuting = computed(
  () => props.windowState.executingNodeIds.length > 0,
)

// ============================================================
// Inline variable monitor
// ============================================================

const varsCollapsed = ref(false)

/** Sort: parameters first, then return value, then other locals */
const sortedVariables = computed(() => {
  const vars = [...props.windowState.variables]
  return vars.sort((a, b) => {
    const order = (tag: string | undefined) =>
      tag === 'parameter' ? 0 : tag === 'return' ? 1 : 2
    return order(a.tag) - order(b.tag)
  })
})

const hasVariables = computed(() => props.windowState.variables.length > 0)

function formatVarValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

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
  <Transition name="sub-fn" appear>
    <div
      v-if="props.windowState.visible"
      class="sub-fn-anchor"
      :style="{
        left: props.windowState.left + 'px',
        top: props.windowState.top + 'px',
      }"
    >
      <div class="sub-fn-window" :class="{ executing: isExecuting, dragging }">
        <!-- Title bar -->
        <div class="sub-fn-titlebar" @mousedown="onDragStart">
          <span class="sub-fn-title">{{ props.windowState.funcName }}</span>
          <button class="sub-fn-close" @click.stop="onClose" :title="'Close'">
            <X :size="15" />
          </button>
        </div>

        <!-- VueFlow -->
        <div class="sub-fn-flow">
          <TooltipProvider :delay-duration="500">
            <VueFlow
              :id="flowId"
              :nodes="props.windowState.nodes"
              :edges="props.windowState.edges"
              :default-viewport="{ zoom: 0.35, x: 50, y: 20 }"
              :min-zoom="0.1"
              :max-zoom="4"
              :nodes-draggable="false"
              :nodes-connectable="false"
              :elements-selectable="false"
              :zoom-on-scroll="true"
              :pan-on-scroll="false"
              :pan-on-drag="true"
            >
              <Background pattern-color="#aaa" :gap="20" />

              <!-- Inline variable monitor — Panel anchored top-left -->
              <Panel position="top-left" class="sub-fn-var-panel">
                <div
                  class="sub-fn-var-monitor"
                  :class="{ collapsed: varsCollapsed }"
                >
                  <button
                    class="sub-fn-var-header"
                    @click="varsCollapsed = !varsCollapsed"
                  >
                    <ChevronRight v-if="varsCollapsed" :size="12" />
                    <ChevronDown v-else :size="12" />
                    <span class="sub-fn-var-title">
                      {{ $t('execution.variables') }}
                      <span class="sub-fn-var-count"
                        >({{ props.windowState.variables.length }})</span
                      >
                    </span>
                  </button>

                  <div
                    v-if="!varsCollapsed && hasVariables"
                    class="sub-fn-var-body"
                  >
                    <div
                      v-for="v in sortedVariables"
                      :key="v.name"
                      class="sub-fn-var-row"
                    >
                      <div class="sub-fn-var-name">
                        <Badge
                          v-if="v.tag === 'return'"
                          variant="default"
                          class="var-tag var-tag--return"
                          >{{ $t('execution.varTagReturn') }}</Badge
                        >
                        <Badge
                          v-if="v.tag === 'parameter'"
                          variant="secondary"
                          class="var-tag var-tag--param"
                          >{{ $t('execution.varTagParameter') }}</Badge
                        >
                        <div class="sub-fn-var-info">
                          <span class="sub-fn-var-label">{{ v.name }}</span>
                          <span class="sub-fn-var-type">{{ v.type }}</span>
                        </div>
                      </div>
                      <span class="sub-fn-var-value">{{
                        formatVarValue(v.value)
                      }}</span>
                    </div>
                  </div>

                  <div
                    v-if="!varsCollapsed && !hasVariables"
                    class="sub-fn-var-empty"
                  >
                    {{ $t('execution.noVariablesShort') }}
                  </div>
                </div>
              </Panel>

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
          </TooltipProvider>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ---- Anchor (handles fixed positioning so ::before glow isn't clipped) ---- */
.sub-fn-anchor {
  position: fixed;
  z-index: 50;
  width: 420px;
  height: 380px;
}

/* ---- Flowing border glow — rendered on the anchor so overflow:hidden on
       the inner window doesn't clip it ---- */
.sub-fn-anchor::before {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 13px;
  padding: 3px;
  background: conic-gradient(
    from var(--fn-border-angle, 0deg),
    transparent 0deg,
    var(--accent) 90deg,
    transparent 180deg,
    var(--accent) 270deg,
    transparent 360deg
  );
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
  z-index: 0;
}

.sub-fn-anchor:has(.sub-fn-window.executing)::before {
  opacity: 1;
  animation: fn-border-spin 2.5s linear infinite;
}

/* ---- Window ---- */
.sub-fn-window {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  background: var(--bg-panel);
  border: 1px solid var(--border-medium);
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition:
    opacity 0.15s ease,
    border-color 0.35s ease,
    box-shadow 0.35s ease;
}

/* While executing: subtle border tint + elevated glow */
.sub-fn-window.executing {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border-medium));
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.3),
    0 0 18px color-mix(in srgb, var(--accent) 25%, transparent);
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

/* ---- Inline variable monitor (glass-morphism Panel) ---- */
.sub-fn-var-panel {
  pointer-events: auto;
}

.sub-fn-var-monitor {
  width: 170px;
  background: color-mix(in srgb, var(--bg-panel) 82%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid color-mix(in srgb, var(--border-medium) 60%, transparent);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  transition: width 0.25s ease;
  user-select: none;
}

.sub-fn-var-monitor.collapsed {
  width: auto;
}

.sub-fn-var-header {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 5px 8px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 10px;
  transition: color 0.15s ease;
}

.sub-fn-var-header:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.sub-fn-var-title {
  font-weight: 600;
  font-size: 10px;
  white-space: nowrap;
}

.sub-fn-var-count {
  font-weight: 400;
  color: var(--text-muted);
}

.sub-fn-var-body {
  max-height: 180px;
  overflow-y: auto;
  padding: 2px 6px 6px;
}

.sub-fn-var-body::-webkit-scrollbar {
  width: 3px;
}

.sub-fn-var-body::-webkit-scrollbar-thumb {
  background: var(--border-medium);
  border-radius: 3px;
}

.sub-fn-var-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 4px;
  padding: 3px 4px;
  border-radius: 4px;
  transition: background 0.12s ease;
}

.sub-fn-var-row:hover {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.sub-fn-var-name {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.sub-fn-var-info {
  display: flex;
  flex-direction: column;
  gap: 0px;
  min-width: 0;
}

.sub-fn-var-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.sub-fn-var-type {
  font-size: 8px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.sub-fn-var-value {
  font-size: 10px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  color: var(--accent);
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  flex-shrink: 0;
}

.var-tag {
  font-size: 8px;
  padding: 0 3px;
  line-height: 14px;
  flex-shrink: 0;
}

.var-tag--return {
  background: color-mix(
    in srgb,
    var(--accent-yellow, #f1c40f) 85%,
    transparent
  );
  color: #1a1a1a;
}

.var-tag--param {
  background: color-mix(in srgb, var(--accent) 25%, transparent);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
}

.sub-fn-var-empty {
  padding: 8px 10px;
  font-size: 10px;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
}
</style>

<!-- unscoped: @property must be global -->
<style>
@property --fn-border-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@keyframes fn-border-spin {
  to {
    --fn-border-angle: 360deg;
  }
}

/* ---- Enter / leave transition (unscoped so Transition classes match reliably) ---- */
/* NOTE: Do NOT animate transform (scale) — VueFlow's ResizeObserver measures
   handle bounds on mount via getBoundingClientRect(), which would report
   coordinates at the scaled size. CSS transforms don't trigger ResizeObserver,
   so the incorrect bounds are never recalculated, causing all edges to shift
   left by ~15% of node width. Opacity-only fade avoids this. */
.sub-fn-enter-active {
  transition: opacity 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.sub-fn-leave-active {
  transition: opacity 0.22s ease-in;
}

.sub-fn-enter-from {
  opacity: 0;
}

.sub-fn-leave-to {
  opacity: 0;
}

/* ---- Variable monitor collapse transition ---- */
.vars-collapse-enter-active {
  transition:
    max-height 0.25s ease,
    opacity 0.2s ease;
  max-height: 180px;
  overflow: hidden;
}

.vars-collapse-leave-active {
  transition:
    max-height 0.2s ease,
    opacity 0.15s ease;
  max-height: 180px;
  overflow: hidden;
}

.vars-collapse-enter-from,
.vars-collapse-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
