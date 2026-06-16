<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { VueFlow, useVueFlow, Panel, type EdgeMarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import type { FlowNode, FlowEdge } from '../engine/flowchart-engine'
import type { VariableEntry } from '@/types'
import InvocationFlowNode from './InvocationFlowNode.vue'
import { LocateFixed } from '@lucide/vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

export interface InvocationViewState {
  id: string
  functionName: string
  instanceId: number
  parentId: string | null
  callSiteNodeId: string | null
  callExpression?: string
  depth: number
  siblingIndex: number
  status: 'active' | 'returning' | 'completed'
  nodes: FlowNode[]
  edges: FlowEdge[]
  executingNodeIds: string[]
  previousNodeId: string | null
  variables: VariableEntry[]
  position: { x: number; y: number }
}

const props = defineProps<{
  invocations: Record<string, InvocationViewState>
  visible: boolean
}>()

const CALL_CANVAS_ID = 'execution-call-canvas'
const { setCenter, setViewport } = useVueFlow(CALL_CANVAS_ID)

const invocationList = computed(() => Object.values(props.invocations))
const rootInvocation = computed(() => invocationList.value.find(inv => inv.parentId === null))

const graphNodes = computed(() =>
  invocationList.value.map(inv => ({
    id: inv.id,
    type: 'invocation',
    position: inv.position,
    data: { invocation: inv },
    draggable: true,
  })),
)

const graphEdges = computed(() =>
  invocationList.value
    .filter(inv => inv.parentId)
    .map(inv => ({
      id: `${inv.parentId}->${inv.id}`,
      source: inv.parentId!,
      target: inv.id,
      type: 'smoothstep',
      animated: inv.status === 'active',
      label: inv.callExpression || inv.functionName,
      markerEnd: { type: 'arrowclosed', color: 'context-stroke' } as EdgeMarkerType,
      style: {
        stroke: inv.status === 'completed' ? 'var(--border-medium)' : 'var(--accent)',
        strokeWidth: inv.status === 'active' ? '2.5' : '1.5',
      },
    })),
)

async function resetCallCanvasViewport() {
  await nextTick()
  await new Promise(resolve => requestAnimationFrame(resolve))
  try {
    await setViewport({ x: 72, y: 72, zoom: 1 }, { duration: 0 })
  } catch {
    // VueFlow can mount one frame later than the overlay.
  }
}

watch(
  () => props.visible && invocationList.value.length,
  count => {
    if (count) void resetCallCanvasViewport()
  },
)

function fitCallTree() {
  void resetCallCanvasViewport()
}

async function centerRoot() {
  const root = rootInvocation.value
  if (!root) return
  try {
    await setCenter(root.position.x + 220, root.position.y + 210, {
      zoom: 1,
      duration: 0,
    })
  } catch {
    // Ignore clicks before VueFlow finishes its viewport setup.
  }
}

function onNodeDragStop(event: any) {
  const id = event?.node?.id
  const position = event?.node?.position
  if (!id || !position || !props.invocations[id]) return
  props.invocations[id].position = { x: position.x, y: position.y }
}
</script>

<template>
  <Transition name="call-canvas">
    <div v-if="visible && invocationList.length" class="call-canvas-shell">
      <VueFlow
        :id="CALL_CANVAS_ID"
        :nodes="graphNodes"
        :edges="graphEdges"
        :default-viewport="{ zoom: 1, x: 72, y: 72 }"
        :min-zoom="1"
        :max-zoom="1"
        :zoom-on-scroll="false"
        :zoom-on-pinch="false"
        :zoom-on-double-click="false"
        @node-drag-stop="onNodeDragStop"
      >
        <Background pattern-color="var(--border-soft)" :gap="28" />
        <Panel position="top-left" class="call-canvas-toolbar">
          <button type="button" class="call-canvas-button" @click="fitCallTree">
            <LocateFixed :size="15" />
            <span>适配调用树</span>
          </button>
          <button type="button" class="call-canvas-button" @click="centerRoot">
            <span>主函数</span>
          </button>
        </Panel>

        <template #node-invocation="nodeProps">
          <InvocationFlowNode v-bind="nodeProps" />
        </template>
      </VueFlow>
    </div>
  </Transition>
</template>

<style>
.call-canvas-shell {
  position: fixed;
  inset: 42px 0 0 0;
  z-index: 35;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-canvas) 92%, transparent), var(--bg-canvas)),
    var(--bg-canvas);
  border-top: 1px solid var(--border-soft);
}

.call-canvas-toolbar {
  display: flex;
  gap: 8px;
  padding: 6px;
  background: color-mix(in srgb, var(--bg-panel) 92%, transparent);
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
}

.call-canvas-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}

.call-canvas-button:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.invocation-card {
  width: 440px;
  height: 420px;
  background: var(--bg-panel);
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.24);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.invocation-card.executing {
  border-color: color-mix(in srgb, var(--accent) 46%, var(--border-medium));
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.24),
    0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent),
    0 0 22px color-mix(in srgb, var(--accent) 24%, transparent);
}

.invocation-card.completed {
  opacity: 0.74;
}

.invocation-titlebar {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 12px;
  background: var(--bg-rail);
  border-bottom: 1px solid var(--border-soft);
}

.invocation-title-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.invocation-title {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
}

.invocation-call {
  max-width: 285px;
  color: var(--text-muted);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invocation-status {
  flex-shrink: 0;
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
}

.invocation-card.completed .invocation-status {
  color: var(--text-muted);
}

.invocation-flow {
  flex: 1;
  min-height: 0;
}

.invocation-var-panel {
  pointer-events: auto;
}

.invocation-var-monitor {
  width: 178px;
  max-height: 190px;
  background: color-mix(in srgb, var(--bg-panel) 94%, transparent);
  border: 1px solid var(--border-soft);
  border-radius: 7px;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
}

.invocation-var-monitor.collapsed {
  width: auto;
}

.invocation-var-header {
  width: 100%;
  height: 28px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border: 0;
  background: var(--bg-rail);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.invocation-var-body {
  max-height: 158px;
  overflow: auto;
}

.invocation-var-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 30px;
  padding: 5px 8px;
  border-top: 1px solid var(--border-soft);
}

.invocation-var-name {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
}

.invocation-var-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.invocation-var-label {
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 700;
}

.invocation-var-type {
  color: var(--text-muted);
  font-size: 10px;
}

.invocation-var-value {
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--accent);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}

.invocation-var-empty {
  padding: 10px;
  color: var(--text-muted);
  font-size: 11px;
}

.var-tag {
  height: 18px;
  padding: 0 5px;
  font-size: 10px;
  border-radius: 4px;
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

.call-canvas-enter-active,
.call-canvas-leave-active {
  transition: opacity 0.18s ease;
}

.call-canvas-enter-from,
.call-canvas-leave-to {
  opacity: 0;
}
</style>
