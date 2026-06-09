<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import StartNode from './node-components/StartNode.vue'
import EndNode from './node-components/EndNode.vue'
import DeclareNode from './node-components/DeclareNode.vue'
import AssignNode from './node-components/AssignNode.vue'
import InputNode from './node-components/InputNode.vue'
import OutputNode from './node-components/OutputNode.vue'
import IfNode from './node-components/IfNode.vue'
import MergeNode from './node-components/MergeNode.vue'
import ForNode from './node-components/ForNode.vue'
import InsertNodePanel from './node-components/InsertNodePanel.vue'
import LayoutDebugPanel from './node-components/LayoutDebugPanel.vue'
import MenuBar from './node-components/MenuBar.vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

// 从 fprg/next.fprg 中读取数据
import fprgXml from './fprg/next.fprg?raw'
import { parseFprgToAst, type Program } from './fprg-ast'
import {
  FlowchartEngine,
  DEFAULT_PARAMS,
  PARAM_DEFS,
  type LayoutParams,
  type FlowNode,
  type FlowEdge,
} from './flowchart-engine'

// ============================================
// 布局参数（可实时调试）
// ============================================
const LP = reactive<LayoutParams>({ ...DEFAULT_PARAMS })

// ============================================
// 初始化引擎
// ============================================
const program: Program = parseFprgToAst(fprgXml)
console.log('AST Program:', program)

const engine = new FlowchartEngine(program, LP)

// 绑定到 VueFlow
const nodes = ref<FlowNode[]>(engine.nodes)
const edges = ref<FlowEdge[]>(engine.edges)

// 布局参数热更新：监听 LP 变化 → 重新排版
let layoutTimer: ReturnType<typeof setTimeout> | null = null
watch(LP, () => {
  if (layoutTimer) clearTimeout(layoutTimer)
  layoutTimer = setTimeout(() => {
    engine.layout()
    // 触发 Vue 响应式：engine 绕过 Proxy 修改了原始对象，需手动通知
    nodes.value = [...engine.nodes]
    console.log('Re-layout done, node count:', nodes.value.length)
  }, 30)
})

console.log('VueFlow nodes:', engine.nodes)
console.log('VueFlow edges:', engine.edges)

const { fitView } = useVueFlow()
onMounted(() => {
  setTimeout(() => fitView(), 100)
})

// ============================================
// 节点插入面板
// ============================================
const panelVisible = ref(false)
const panelPosition = ref({ x: 0, y: 0 })
const clickedEdgeId = ref<string | null>(null)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onEdgeClick(data: any) {
  clickedEdgeId.value = data.edge.id
  panelPosition.value = { x: data.event.clientX + 24, y: data.event.clientY - 120 }
  panelVisible.value = true
}

function onInsertNode(type: string) {
  if (clickedEdgeId.value) {
    engine.insertNodeAtEdge(clickedEdgeId.value, type)
    nodes.value = [...engine.nodes]
    edges.value = [...engine.edges]
    console.log(`Inserted "${type}" at edge ${clickedEdgeId.value}, nodes: ${nodes.value.length}`)
  }
  panelVisible.value = false
}
</script>

<template>
  <div class="flowchart-sandbox">
    <MenuBar />
    <div class="flow-container">
      <VueFlow
        :nodes="nodes"
        :edges="edges"
        :default-viewport="{ zoom: 1, x: 50, y: 20 }"
        :min-zoom="0.1"
        :max-zoom="4"
        fit-view-on-init
        @edge-click="onEdgeClick"
      >
        <Background pattern-color="#aaa" :gap="20" />
        <Controls />
        <template #node-start="nodeProps"
          ><StartNode v-bind="nodeProps"
        /></template>
        <template #node-end="nodeProps"
          ><EndNode v-bind="nodeProps"
        /></template>
        <template #node-default="nodeProps"
          ><div class="default-node-fallback" :style="{ width: (nodeProps.data?.width ?? 120) + 'px', height: (nodeProps.data?.height ?? 50) + 'px' }">{{ nodeProps.data?.label ?? '' }}</div
        /></template>
        <template #node-declare="nodeProps"
          ><DeclareNode v-bind="nodeProps"
        /></template>
        <template #node-assign="nodeProps"
          ><AssignNode v-bind="nodeProps"
        /></template>
        <template #node-fg-input="nodeProps"
          ><InputNode v-bind="nodeProps"
        /></template>
        <template #node-fg-output="nodeProps"
          ><OutputNode v-bind="nodeProps"
        /></template>
        <template #node-fg-if="nodeProps"
          ><IfNode v-bind="nodeProps"
        /></template>
        <template #node-fg-merge="nodeProps"
          ><MergeNode v-bind="nodeProps"
        /></template>
        <template #node-fg-for="nodeProps"
          ><ForNode v-bind="nodeProps"
        /></template>
      </VueFlow>
    </div>
    <LayoutDebugPanel :params="LP" :definitions="PARAM_DEFS" />
    <InsertNodePanel
      v-if="panelVisible"
      :position="panelPosition"
      @close="panelVisible = false"
      @insert="onInsertNode"
    />
  </div>
</template>

<style scoped>
.flowchart-sandbox {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1a1a2e;
}
.flow-container {
  flex: 1;
  width: 100%;
}
</style>

<style>
/* 连接线基础样式 */
.vue-flow__edge-path {
  stroke-width: 2px;
  transition: stroke 0.2s ease;
}

/* hover 效果：仅改变 stroke 颜色，避免 CSS filter 触发 Chromium SVG 合成层闪烁 */
.vue-flow__edge:hover .vue-flow__edge-path {
  stroke: #4fc3f7;
}
</style>
