<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { VueFlow, useVueFlow, Panel } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import type { InvocationViewState } from './ExecutionCallCanvas.vue'
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
import { Badge } from '@/components/ui/badge'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ChevronDown, ChevronRight } from '@lucide/vue'

const props = defineProps<{
  data: {
    invocation: InvocationViewState
  }
}>()

const inv = computed(() => props.data.invocation)
const flowId = computed(() => `call-node-${inv.value.id}`)
const { updateNodeData, findEdge } = useVueFlow(flowId.value)
const varsCollapsed = ref(false)
const lastHighlightedIds = ref<Set<string>>(new Set())

const sortedVariables = computed(() => {
  const vars = [...inv.value.variables]
  return vars.sort((a, b) => {
    const order = (tag: string | undefined) =>
      tag === 'parameter' ? 0 : tag === 'return' ? 1 : 2
    return order(a.tag) - order(b.tag)
  })
})

const hasVariables = computed(() => inv.value.variables.length > 0)
const title = computed(() => `${inv.value.functionName} #${inv.value.instanceId}`)
const statusLabel = computed(() => {
  if (inv.value.status === 'completed') return '已返回'
  if (inv.value.status === 'returning') return '返回中'
  return '运行中'
})

function formatVarValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

// Track the currently animated edge so we can clear it on transition
let previousAnimatedEdgeId: string | null = null

function resetAllHighlights() {
  for (const id of lastHighlightedIds.value) {
    updateNodeData(id, { executing: false })
  }
  lastHighlightedIds.value = new Set()

  if (previousAnimatedEdgeId) {
    const edge = findEdge(previousAnimatedEdgeId)
    if (edge) edge.animated = false
    previousAnimatedEdgeId = null
  }
}

watch(
  () => [...inv.value.executingNodeIds],
  newIds => {
    const newSet = new Set(newIds)
    const prevSet = lastHighlightedIds.value

    for (const id of newSet) {
      if (!prevSet.has(id)) updateNodeData(id, { executing: true })
    }

    for (const id of prevSet) {
      if (!newSet.has(id)) updateNodeData(id, { executing: false })
    }

    lastHighlightedIds.value = newSet
  },
)

// Animate the edge indicated by activeEdgeId (set by handleInvocationStatementEnter)
watch(
  () => inv.value.activeEdgeId,
  (newEdgeId) => {
    // Clear previously animated edge
    if (previousAnimatedEdgeId) {
      const prevEdge = findEdge(previousAnimatedEdgeId)
      if (prevEdge) prevEdge.animated = false
    }

    // Animate the new edge
    if (newEdgeId) {
      const edge = findEdge(newEdgeId)
      if (edge) edge.animated = true
    }

    previousAnimatedEdgeId = newEdgeId ?? null
  },
)

onUnmounted(resetAllHighlights)
</script>

<template>
  <div class="invocation-card-wrapper" :class="{ executing: inv.executingNodeIds.length > 0 }">
    <div class="invocation-card" :class="[inv.status]">
    <div class="invocation-titlebar">
      <div class="invocation-title-main">
        <span class="invocation-title">{{ title }}</span>
        <span v-if="inv.callExpression" class="invocation-call">{{ inv.callExpression }}</span>
      </div>
      <span class="invocation-status">{{ statusLabel }}</span>
    </div>

    <div class="invocation-flow">
      <TooltipProvider :delay-duration="500">
        <VueFlow
          :id="flowId"
          :nodes="inv.nodes"
          :edges="inv.edges"
          :default-viewport="{ zoom: 0.35, x: 50, y: 20 }"
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
          <Panel position="top-left" class="invocation-var-panel">
            <div class="invocation-var-monitor" :class="{ collapsed: varsCollapsed }">
              <button class="invocation-var-header" @click="varsCollapsed = !varsCollapsed">
                <ChevronRight v-if="varsCollapsed" :size="12" />
                <ChevronDown v-else :size="12" />
                <span class="invocation-var-title">
                  变量 <span class="invocation-var-count">({{ inv.variables.length }})</span>
                </span>
              </button>

              <div v-if="!varsCollapsed && hasVariables" class="invocation-var-body">
                <div v-for="v in sortedVariables" :key="v.name" class="invocation-var-row">
                  <div class="invocation-var-name">
                    <Badge v-if="v.tag === 'return'" variant="default" class="var-tag var-tag--return">返回</Badge>
                    <Badge v-if="v.tag === 'parameter'" variant="secondary" class="var-tag var-tag--param">参数</Badge>
                    <div class="invocation-var-info">
                      <span class="invocation-var-label">{{ v.name }}</span>
                      <span class="invocation-var-type">{{ v.type }}</span>
                    </div>
                  </div>
                  <span class="invocation-var-value">{{ formatVarValue(v.value) }}</span>
                </div>
              </div>

              <div v-if="!varsCollapsed && !hasVariables" class="invocation-var-empty">暂无变量</div>
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
</template>
