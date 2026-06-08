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
import ForNode from './node-components/ForNode.vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

// 1. 测试
// 从fprg/next.fprg中读取数据 → AST → VueFlow 节点/边
import fprgXml from './fprg/next.fprg?raw'
import { parseFprgToAst, statementToLabel, type Program, type Statement, type IfStatement, type ForStatement } from './fprg-ast'

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
  'for':     'fg-for',
  'do':      'default',
  'more':    'default',
}
const SPACING = 60
const START_Y = 50

// ============================================
// Layout constants (仿 flowgorithm.js drawSelection)
// ============================================
const NODE_H = 50
const IF_NODE_H = 80        // IfNode.vue 默认高度
const IF_NODE_MIN_W = 160   // IfNode.vue 默认宽度
const FOR_NODE_H = 80       // ForNode.vue 默认高度
const FOR_NODE_MIN_W = 160  // ForNode.vue 默认宽度
const MERGE_NODE_W = 20     // MergeNode.vue 宽度/高度
const MERGE_NODE_H = 20
const START_W = 80          // StartNode / EndNode 宽度
const START_END_H = 40      // StartNode / EndNode 高度
const BRANCH_H_GAP = 50     // 分支与菱形顶点的水平间距
const BRANCH_V_GAP = 30     // 分支内容与菱形底部的垂直间距
const FLOW_CENTER_X = 400   // 流程水平中心点
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
    const nodeWidth = type === 'fg-merge' ? 20 : Math.max(width ?? textWidth + 40, MIN_W)
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

  function connect(from: FlowNode, to: FlowNode, opts?: { sourceHandle?: string; targetHandle?: string }) {
    const sh = opts?.sourceHandle
    const th = opts?.targetHandle
    edges.push({
      id: `edge_${from.id}_${to.id}${sh ? '_' + sh : ''}${th ? '_' + th : ''}`,
      source: from.id,
      target: to.id,
      sourceHandle: sh,
      targetHandle: th,
      type: (sh || th) ? 'step' : 'default',
    })
  }

  /**
   * 递归处理一组语句，返回 [首节点, 尾节点]
   * 遇 if 语句则深度优先地构建子图（if-node → branches → merge-node）
   */
  function processSequence(statements: Statement[]): [FlowNode, FlowNode] {
    let first: FlowNode | null = null
    let prev: FlowNode | null = null

    for (const stmt of statements) {
      if (stmt.kind === 'if') {
        const [ifNode, mergeNode] = buildIfStatement(stmt, prev)
        if (!first) first = ifNode
        prev = mergeNode
      } else if (stmt.kind === 'for') {
        const forNode = buildForStatement(stmt, prev)
        if (!first) first = forNode
        prev = forNode
      } else {
        const nodeType = KIND_TO_NODE_TYPE[stmt.kind] ?? 'default'
        const label = statementToLabel(stmt)
        const node = createNode(nodeType, label, undefined, stmt)
        stmt._nodeId = node.id
        if (prev) connect(prev, node)
        if (!first) first = node
        prev = node
      }
    }

    return [first!, prev!]
  }

  /**
   * 处理单个分支（then 或 else）：
   * - 空分支：直接连接 fromNode → toNode（带 handle）
   * - 非空：递归 processSequence，首尾用指定 handle 连接
   */
  function processBranch(
    statements: Statement[],
    fromNode: FlowNode,
    fromHandle: string,
    toNode: FlowNode,
    toHandle: string,
  ): void {
    if (statements.length === 0) {
      connect(fromNode, toNode, { sourceHandle: fromHandle, targetHandle: toHandle })
      return
    }
    const [first, last] = processSequence(statements)
    connect(fromNode, first, { sourceHandle: fromHandle })
    connect(last, toNode, { targetHandle: toHandle })
  }

  /**
   * 构建 if 判断节点 + 汇集点，递归处理 then/else 分支
   * 返回 [ifNode, mergeNode]（首节点 + 尾节点）
   */
  function buildIfStatement(stmt: IfStatement & { _nodeId?: string }, prevNode: FlowNode | null): [FlowNode, FlowNode] {
    const ifNode = createNode('fg-if', stmt.expression, undefined, stmt)
    stmt._nodeId = ifNode.id
    if (prevNode) connect(prevNode, ifNode)

    const mergeNode = createNode('fg-merge', '', 20)
    mergeNode.data.ifNodeId = ifNode.id

    processBranch(stmt.thenBranch, ifNode, 'then', mergeNode, 'then-in')
    processBranch(stmt.elseBranch, ifNode, 'else', mergeNode, 'else-in')

    return [ifNode, mergeNode]
  }

  /**
   * 构建 for 循环节点，递归处理 body
   * 返回 forNode（自身作为出口，Bottom source 连下一条语句）
   */
  function buildForStatement(stmt: ForStatement & { _nodeId?: string }, prevNode: FlowNode | null): FlowNode {
    const label = statementToLabel(stmt)
    const forNode = createNode('fg-for', label, undefined, stmt)
    stmt._nodeId = forNode.id
    if (prevNode) connect(prevNode, forNode)

    // body 从 loop-body(Right source) 出 → loop-back(Bottom target) 回
    processBranch(stmt.body, forNode, 'loop-body', forNode, 'loop-back')

    return forNode
  }

  // START
  let prev: FlowNode = createNode('start', 'START', 80)

  // 遍历 Main 函数 body 中的每条语句（递归处理嵌套 if/for）
  for (const stmt of mainFunc.body) {
    console.log('Processing statement:', stmt)
    if (stmt.kind === 'if') {
      const [, mergeNode] = buildIfStatement(stmt, prev)
      prev = mergeNode
    } else if (stmt.kind === 'for') {
      prev = buildForStatement(stmt, prev)
    } else {
      const nodeType = KIND_TO_NODE_TYPE[stmt.kind] ?? 'default'
      const label = statementToLabel(stmt)
      const node = createNode(nodeType, label, undefined, stmt)
      stmt._nodeId = node.id
      connect(prev, node)
      prev = node
    }
  }

  // END
  const endNode = createNode('end', 'END', 80)
  connect(prev, endNode)

  return { nodes, edges, nodesMap }
}

/**
 * 根据 ifNodeId 查找对应的 merge 节点
 */
function findMergeNode(ifNodeId: string, nodesMap: Map<string, FlowNode>): FlowNode | undefined {
  for (const node of nodesMap.values()) {
    if (node.type === 'fg-merge' && node.data.ifNodeId === ifNodeId) return node
  }
}

/** 排版结果：块结束 Y 坐标 + 块内最大宽度 */
interface LayoutResult {
  endY: number
  width: number
}

/**
 * 测量拓展信息
 * leftExtent  — 块中心到块内最左边缘的距离
 * rightExtent — 块中心到块内最右边缘的距离
 * totalWidth  — leftExtent + rightExtent
 */
interface Extents {
  leftExtent: number
  rightExtent: number
  totalWidth: number
}

function makeExtents(left: number, right: number): Extents {
  return { leftExtent: left, rightExtent: right, totalWidth: left + right }
}

/**
 * 纯测量：递归计算一组语句的左右拓展（不设 position）
 * 仿 flowgorithm.js：
 *   - calcBlockX → 左拓展（用于 then 分支靠右对齐）
 *   - calcBlockWidth - calcBlockX → 右拓展（用于 else 分支靠左对齐）
 */
function measureExtents(statements: Statement[], nodesMap: Map<string, FlowNode>): Extents {
  let left = 0
  let right = 0

  for (const stmt of statements) {
    if (stmt.kind === 'if') {
      const ifNode = nodesMap.get(stmt._nodeId!)
      const ifW = ifNode?.data.width ?? IF_NODE_MIN_W
      const thenE = measureExtents(stmt.thenBranch, nodesMap)
      const elseE = measureExtents(stmt.elseBranch, nodesMap)
      // if-block 右拓展 = max(菱形右半, 菱形右顶点 + 间隙 + then 分支全宽)
      const blockRight = Math.max(ifW / 2, ifW / 2 + BRANCH_H_GAP + thenE.totalWidth)
      // if-block 左拓展 = max(菱形左半, 菱形左顶点 + 间隙 + else 分支全宽)
      const blockLeft = Math.max(ifW / 2, ifW / 2 + BRANCH_H_GAP + elseE.totalWidth)
      left = Math.max(left, blockLeft)
      right = Math.max(right, blockRight)
    } else if (stmt.kind === 'for') {
      const forNode = nodesMap.get(stmt._nodeId!)
      const forW = forNode?.data.width ?? FOR_NODE_MIN_W
      const bodyE = measureExtents(stmt.body, nodesMap)
      // for 体仅在右侧：右拓展 = max(for右半, for右半 + 间隙 + body全宽)
      const blockRight = Math.max(forW / 2, forW / 2 + BRANCH_H_GAP + bodyE.totalWidth)
      left = Math.max(left, forW / 2)
      right = Math.max(right, blockRight)
    } else {
      const node = nodesMap.get(stmt._nodeId!)
      const w = (node?.data.width ?? 100) / 2
      left = Math.max(left, w)
      right = Math.max(right, w)
    }
  }

  return makeExtents(left, right)
}

/**
 * 递归排版一组语句（序列），在局部 centerX / startY 坐标系内排列。
 * 返回该块结束时的 Y 坐标和块内最大宽度。
 */
function layoutBlock(
  statements: Statement[],
  centerX: number,
  startY: number,
  nodesMap: Map<string, FlowNode>,
): LayoutResult {
  let cursor = startY
  let maxW = 0

  for (const stmt of statements) {
    if (stmt.kind === 'if') {
      const result = layoutIfSelection(stmt, centerX, cursor, nodesMap)
      cursor = result.endY
      maxW = Math.max(maxW, result.width)
    } else if (stmt.kind === 'for') {
      const result = layoutForSelection(stmt, centerX, cursor, nodesMap)
      cursor = result.endY
      maxW = Math.max(maxW, result.width)
    } else {
      const node = nodesMap.get(stmt._nodeId!)
      if (node) {
        const w = node.data.width ?? 100
        maxW = Math.max(maxW, w)
        node.position = { x: centerX - w / 2, y: cursor }
        cursor += NODE_H + SPACING
      }
    }
  }

  return { endY: cursor, width: maxW }
}

/**
 * 排版 if 语句（仿 flowgorithm.js drawSelection）：
 * 1. if 菱形节点置于顶部居中
 * 2. then 分支递归排版于右侧
 * 3. else 分支递归排版于左侧
 * 4. merge 节点置于较深分支底部居中
 * 5. 返回整个 if-block 的结束 Y 和总宽度
 */
function layoutIfSelection(
  stmt: IfStatement & { _nodeId?: string },
  centerX: number,
  startY: number,
  nodesMap: Map<string, FlowNode>,
): LayoutResult {
  const ifNode = nodesMap.get(stmt._nodeId!)
  if (!ifNode) return { endY: startY, width: 0 }

  const ifW = ifNode.data.width ?? IF_NODE_MIN_W

  // 1. 放置 if 菱形节点
  ifNode.position = { x: centerX - ifW / 2, y: startY }
  const branchStartY = startY + IF_NODE_H + BRANCH_V_GAP

  // 2. 测量 then 分支左右拓展 → 用左拓展确定 centerX → 递归排版
  const thenExtents = measureExtents(stmt.thenBranch, nodesMap)
  const thenCenterX = centerX + ifW / 2 + BRANCH_H_GAP + thenExtents.leftExtent
  const thenResult = layoutBlock(stmt.thenBranch, thenCenterX, branchStartY, nodesMap)

  // 3. 测量 else 分支左右拓展 → 用右拓展确定 centerX → 递归排版
  const elseExtents = measureExtents(stmt.elseBranch, nodesMap)
  const elseCenterX = centerX - ifW / 2 - BRANCH_H_GAP - elseExtents.rightExtent
  const elseResult = layoutBlock(stmt.elseBranch, elseCenterX, branchStartY, nodesMap)

  // 4. 以实际排版结果的分支宽度为准
  const totalWidth = ifW + BRANCH_H_GAP * 2 + thenResult.width + elseResult.width

  // 5. merge 节点在较深分支下方居中（与 if 菱形 X 中心对齐）
  const maxBranchEndY = Math.max(thenResult.endY, elseResult.endY)
  const mergeNode = findMergeNode(ifNode.id, nodesMap)
  if (mergeNode) {
    mergeNode.position = { x: centerX - MERGE_NODE_W / 2, y: maxBranchEndY + BRANCH_V_GAP }
  }

  return {
    endY: maxBranchEndY + MERGE_NODE_H + BRANCH_V_GAP + SPACING,
    width: totalWidth,
  }
}

/**
 * 排版 for 语句：
 * 1. for 六边形节点置于顶部居中
 * 2. body 递归排版于右侧（与 forNode 同 Y 起点）
 * 3. forNode 自身底部为出口，endY 取 for 底部与 body 结束的较大者
 */
function layoutForSelection(
  stmt: ForStatement & { _nodeId?: string },
  centerX: number,
  startY: number,
  nodesMap: Map<string, FlowNode>,
): LayoutResult {
  const forNode = nodesMap.get(stmt._nodeId!)
  if (!forNode) return { endY: startY, width: 0 }

  const forW = forNode.data.width ?? FOR_NODE_MIN_W
  const forH = forNode.data.height ?? FOR_NODE_H

  // 1. 放置 for 六边形节点
  forNode.position = { x: centerX - forW / 2, y: startY }

  // 2. 测量并排版 body（右侧，从 forNode 下方开始）
  const bodyExtents = measureExtents(stmt.body, nodesMap)
  const bodyCenterX = centerX + forW / 2 + BRANCH_H_GAP + bodyExtents.leftExtent
  const bodyStartY = startY + forH + BRANCH_V_GAP
  const bodyResult = layoutBlock(stmt.body, bodyCenterX, bodyStartY, nodesMap)

  const totalWidth = forW + BRANCH_H_GAP + bodyResult.width
  // endY: 取 forNode 底部与 body 结束的较大者 + 间距
  const endY = Math.max(startY + forH, bodyResult.endY) + SPACING

  return { endY, width: totalWidth }
}

/**
 * 流程入口排版函数：
 * 放置 START → 递归排版 Main body → 放置 END
 */
function layoutFlowchart(program: Program, nodesMap: Map<string, FlowNode>): void {
  const mainFunc = program.functions.find((f) => f.name === 'Main')
  if (!mainFunc) return

  // 查找 START/END 节点
  let startNode: FlowNode | undefined
  let endNode: FlowNode | undefined
  for (const node of nodesMap.values()) {
    if (node.type === 'start') startNode = node
    if (node.type === 'end') endNode = node
  }

  // 放置 START
  const startX = FLOW_CENTER_X - START_W / 2
  if (startNode) {
    startNode.position = { x: startX, y: START_Y }
  }

  // 递归排版 Main body
  const bodyStartY = START_Y + START_END_H + SPACING
  const bodyResult = layoutBlock(mainFunc.body, FLOW_CENTER_X, bodyStartY, nodesMap)

  // 放置 END
  if (endNode) {
    endNode.position = { x: startX, y: bodyResult.endY }
  }
}

// 解析 fprg → AST → VueFlow 数据
const program = parseFprgToAst(fprgXml)
console.log('AST Program:', program)

// 1. 初始化 fprg → VueFlow 节点/边（纯数据，不排版）
const { nodes: parsedNodes, edges: parsedEdges, nodesMap } = initAstToFlowchart(program)

// 2. 递归排版布局（仿 flowgorithm.js drawSelection）
layoutFlowchart(program, nodesMap)
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
  | 'fg-for'
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
    /** merge 节点记录其所属 if 节点 ID，用于居中对齐 */
    ifNodeId?: string
  }
}

interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: string
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
        <template #node-fg-for="nodeProps"
          ><ForNode v-bind="nodeProps"
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

