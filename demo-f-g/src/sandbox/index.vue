<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

// 1. 测试
// 从fprg/next.fprg中读取数据 → AST → VueFlow 节点/边
import fprgXml from './fprg/next.fprg?raw'
import { parseFprgToAst, statementToLabel, type Program, type Statement } from './fprg-ast'

/**
 * AST 语句 kind → VueFlow 节点类型 映射
 * 尚未实现组件的类型（if/while/for/do/more）暂时映射到 'default'
 */
const KIND_TO_NODE_TYPE: Record<Statement['kind'], FlowNodeType> = {
  'declare': 'declare',
  'assign':  'assign',
  'input':   'fg-input',
  'output':  'fg-output',
  'call':    'call',
  'if':      'fg-if',
  'while':   'default',
  'for':     'default',
  'do':      'default',
  'more':    'default',
}
const SPACING = 60
const START_Y = 50
/**
 * 将 AST 的 Main 函数转换为 VueFlow 节点/边
 * (当前按顺序语句线性渲染，if/while/for/do 嵌套体留待后续)
 */
function initAstToFlowchart(program: Program): { nodes: FlowNode[]; edges: FlowEdge[], nodesMap: Map<string, FlowNode> } {
  const mainFunc = program.functions.find((f) => f.name === 'Main')
  if (!mainFunc) return { nodes: [], edges: [], nodesMap: new Map() }

  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []
  const nodesMap = new Map<string, FlowNode>()
  let idCounter = 0
  const newId = () => 'node_' + ++idCounter
  const NODE_H = 50
  const MIN_W = 100
  function createNode(type: FlowNodeType, label: string, width?: number, statement?: Statement): FlowNode {
    const textWidth = label.length * 8
    const nodeWidth = Math.max(width ?? textWidth + 40, MIN_W)
    const node: FlowNode = {
      id: newId(),
      type,
      position: { x: 0, y: 0 },
      data: { label, width: nodeWidth, height: NODE_H, statement },
    }
    nodes.push(node)
    nodesMap.set(node.id, node)
    return node
  }

  function connect(from: FlowNode, to: FlowNode) {
    edges.push({
      id: `edge_${from.id}_${to.id}`,
      source: from.id,
      target: to.id,
    })
  }

  // START
  let prev = createNode('start', 'START', 80)

  // 遍历 Main 函数 body 中的每条语句
  for (const stmt of mainFunc.body) {
    console.log('Processing statement:', stmt)
    const nodeType = KIND_TO_NODE_TYPE[stmt.kind] ?? 'default'
    const label = statementToLabel(stmt)
    const node = createNode(nodeType, label, undefined, stmt)
    stmt._nodeId = node.id // 将生成的节点ID附加到语句对象上，后续处理嵌套语句时可用
    connect(prev, node)
    prev = node
  }

  // END
  const endNode = createNode('end', 'END', 80)
  connect(prev, endNode)

  return { nodes, edges, nodesMap }
}

/**
 * 简单顺序排版：将节点按 Y 游标垂直排列
 * (仅处理线性语句，if/while/for/do 嵌套体留待后续)
 */
function layoutSequence(nodes: FlowNode[]): void {
  const NODE_H = 50
  // 计算最大宽度，用于 X 轴中心对齐
  const maxWidth = Math.max(...nodes.map(n => n.data.width ?? 100))
  let yCursor = START_Y
  for (const node of nodes) {
    const w = node.data.width ?? 100
    node.position.x = (maxWidth - w) / 2
    node.position.y = yCursor
    yCursor += NODE_H + SPACING
  }
}

// 解析 fprg → AST → VueFlow 数据
const program = parseFprgToAst(fprgXml)
console.log('AST Program:', program)

// 1. 初始化 fprg → VueFlow 节点/边（纯数据，不排版）
const { nodes: parsedNodes, edges: parsedEdges, nodesMap } = initAstToFlowchart(program)

// 2. 排版布局
layoutSequence(parsedNodes)
console.log('Program :', program) // program的statement对象已有_nodeId
console.log('VueFlow nodes:', parsedNodes)
console.log('VueFlow edges:', parsedEdges)
console.log('VueFlow nodesMap:', nodesMap)


// 3. 绑定到 VueFlow
const nodes = ref<FlowNode[]>(parsedNodes)
const edges = ref<FlowEdge[]>(parsedEdges)


// ============================================
// Types
// ============================================
type FlowNodeType =
  | 'start'
  | 'end'
  | 'declare'
  | 'assign'
  | 'fg-input'
  | 'fg-output'
  | 'call'
  | 'fg-if'
  | 'fg-merge'
  | 'default'

interface FlowNode {
  id: string
  type: FlowNodeType
  position: {
    x: number
    y: number
  }
  data: {
    label: string
    width?: number
    height?: number
    statement?: Statement
  }
}

interface FlowEdge {
  id: string
  source: string
  target: string
}

const { fitView } = useVueFlow()
onMounted(() => {
  setTimeout(() => fitView(), 100)
})
</script>

<template>
  <div class="flowchart-sandbox">
    <div class="header">
      <h1>Flowgorithm JS - VueFlow Edition</h1>
      <p>Sequence Flowchart Demo</p>
    </div>
    <div class="flow-container">
      <VueFlow
        :nodes="nodes"
        :edges="edges"
        :default-viewport="{ zoom: 1, x: 50, y: 20 }"
        :min-zoom="0.1"
        :max-zoom="4"
        fit-view-on-init
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
      </VueFlow>
    </div>
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
.header {
  padding: 20px;
  color: #eee;
  text-align: center;
}
.header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 300;
}
.header p {
  margin: 8px 0 0;
  color: #888;
}
.flow-container {
  flex: 1;
  width: 100%;
}
</style>

