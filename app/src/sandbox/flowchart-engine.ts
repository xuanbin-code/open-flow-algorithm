// ============================================================
// flowchart-engine.ts — 流程图节点渲染 + 布局引擎
//
// 职责：
//   1. 将 AST Program 转换为 VueFlow 节点/边
//   2. 递归排版布局（仿 flowgorithm.js drawSelection）
//   3. 支持布局参数热更新
//
// 独立于 Vue 组件层，可单独测试。
// ============================================================

import {
  type Program,
  type Statement,
  type IfStatement,
  type ForStatement,
  type WhileStatement,
  statementToLabel,
  createDefaultStatement,
  findStatementLocation,
  isStatementEmpty,
} from './fprg-ast'
import type { EdgeMarkerType } from '@vue-flow/core'
import { measureTextWidth } from './text-measure'

// ============================================================
// Types
// ============================================================

export type FlowNodeType =
  | 'start'
  | 'end'
  | 'declare'
  | 'assign'
  | 'fg-input'
  | 'fg-output'
  | 'call'
  | 'fg-if'
  | 'fg-for'
  | 'fg-while'
  | 'fg-merge'
  | 'default'

export interface FlowNode {
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
    /** 节点内容是否为空（未配置属性） */
    isEmpty?: boolean
    /** merge 节点记录其所属 if 节点 ID，用于居中对齐 */
    ifNodeId?: string
    /** 是否正在执行（运行时高亮） */
    executing?: boolean
  }
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null | undefined
  targetHandle?: string | null | undefined
  type?: string
  markerEnd?: EdgeMarkerType
  animated?: boolean
}

export interface LayoutParams {
  SPACING: number
  START_Y: number
  NODE_H: number
  MIN_W: number
  IF_NODE_H: number
  IF_NODE_MIN_W: number
  FOR_NODE_H: number
  FOR_NODE_MIN_W: number
  WHILE_NODE_H: number
  WHILE_NODE_MIN_W: number
  MERGE_NODE_W: number
  MERGE_NODE_H: number
  START_W: number
  START_END_H: number
  BRANCH_H_GAP: number
  BRANCH_V_GAP: number
  FLOW_CENTER_X: number
}

// ============================================================
// Defaults
// ============================================================

export const DEFAULT_PARAMS: LayoutParams = {
  SPACING: 30,
  START_Y: 50,
  NODE_H: 50,
  MIN_W: 80,
  IF_NODE_H: 80,
  IF_NODE_MIN_W: 160,
  FOR_NODE_H: 80,
  FOR_NODE_MIN_W: 160,
  WHILE_NODE_H: 80,
  WHILE_NODE_MIN_W: 160,
  MERGE_NODE_W: 20,
  MERGE_NODE_H: 20,
  START_W: 80,
  START_END_H: 40,
  BRANCH_H_GAP: 50,
  BRANCH_V_GAP: 30,
  FLOW_CENTER_X: 400
}

export const PARAM_DEFS = [
  { key: 'SPACING', label: '垂直间距 SPACING', min: 5, max: 300, step: 5 },
  { key: 'START_Y', label: '起始 Y START_Y', min: 0, max: 500, step: 10 },
  { key: 'FLOW_CENTER_X', label: '水平中心 FLOW_CENTER_X', min: 100, max: 1500, step: 10 },
  { key: 'BRANCH_H_GAP', label: '水平分支间距 BRANCH_H_GAP', min: 10, max: 300, step: 5 },
  { key: 'BRANCH_V_GAP', label: '垂直分支间距 BRANCH_V_GAP', min: 5, max: 200, step: 5 },
  { key: 'NODE_H', label: '普通节点高 NODE_H', min: 30, max: 200, step: 5 },
  { key: 'MIN_W', label: '普通节点最小宽 MIN_W', min: 40, max: 300, step: 10 },
  { key: 'IF_NODE_H', label: 'If 节点高 IF_NODE_H', min: 40, max: 300, step: 5 },
  { key: 'IF_NODE_MIN_W', label: 'If 节点最小宽 IF_NODE_MIN_W', min: 80, max: 500, step: 10 },
  { key: 'FOR_NODE_H', label: 'For 节点高 FOR_NODE_H', min: 40, max: 300, step: 5 },
  { key: 'FOR_NODE_MIN_W', label: 'For 节点最小宽 FOR_NODE_MIN_W', min: 80, max: 500, step: 10 },
  { key: 'WHILE_NODE_H', label: 'While 节点高 WHILE_NODE_H', min: 40, max: 300, step: 5 },
  { key: 'WHILE_NODE_MIN_W', label: 'While 节点最小宽 WHILE_NODE_MIN_W', min: 80, max: 500, step: 10 },
  { key: 'MERGE_NODE_W', label: 'Merge 节点宽 MERGE_NODE_W', min: 10, max: 80, step: 2 },
  { key: 'MERGE_NODE_H', label: 'Merge 节点高 MERGE_NODE_H', min: 10, max: 80, step: 2 },
  { key: 'START_W', label: 'Start 节点宽 START_W', min: 40, max: 300, step: 5 },
  { key: 'START_END_H', label: 'Start/End 高 START_END_H', min: 20, max: 150, step: 5 }
]

// ============================================================
// Internal helpers
// ============================================================

const KIND_TO_NODE_TYPE: Record<Statement['kind'], FlowNodeType> = {
  declare: 'declare',
  assign: 'assign',
  input: 'fg-input',
  output: 'fg-output',
  call: 'call',
  if: 'fg-if',
  while: 'fg-while',
  for: 'fg-for',
  do: 'default',
  more: 'default'
}

/** clip-path 形状的文本可视区小于 CSS 宽度，需要放大系数 */
const SHAPE_WIDTH_FACTOR: Partial<Record<FlowNodeType, number>> = {
  'fg-if': 1.9,   // 菱形可视区约 55%
  'fg-for': 1.7,   // 六边形可视区约 60%
  'fg-while': 1.7, // 六边形可视区约 60%
}

const NODE_MAX_W = 400   // 节点最大宽度
const NODE_PAD_X = 28    // 左右 padding 总和

interface LayoutResult {
  endY: number
  width: number
}

interface Extents {
  leftExtent: number
  rightExtent: number
  totalWidth: number
}

// ============================================================
// FlowchartEngine
// ============================================================

export class FlowchartEngine {
  readonly nodes: FlowNode[] = []
  readonly edges: FlowEdge[] = []
  readonly nodesMap = new Map<string, FlowNode>()

  /** 布局参数引用（外部 reactive 对象，可直接修改触发热更新） */
  params: LayoutParams

  private program: Program
  private idCounter = 0

  constructor(program: Program, params: LayoutParams) {
    this.program = program
    this.params = params
    this.initGraph()
    this.layoutFlowchart()
  }

  // ==========================================
  // Public API
  // ==========================================

  /** 热重跑布局（参数变化后调用） */
  layout(): void {
    this.layoutFlowchart()
  }

  // ==========================================
  // Phase 1: AST → Nodes / Edges
  // ==========================================

  private initGraph(): void {
    // 始终创建 START 节点
    let prev: FlowNode = this.createNode('start', '开始', 80)

    // 遍历 Main 函数 body 中的每条语句（递归处理嵌套 if/for）
    const mainFunc = this.program.functions.find(f => f.name === 'Main')
    if (mainFunc) {
      for (const stmt of mainFunc.body) {
        if (stmt.kind === 'if') {
          const [, mergeNode] = this.buildIfStatement(stmt, prev)
          prev = mergeNode
        } else if (stmt.kind === 'for') {
          prev = this.buildForStatement(stmt, prev)
        } else if (stmt.kind === 'while') {
          prev = this.buildWhileStatement(stmt, prev)
        } else {
          const nodeType = KIND_TO_NODE_TYPE[stmt.kind] ?? 'default'
          const label = statementToLabel(stmt)
          const node = this.createNode(nodeType, label, undefined, stmt)
          stmt._nodeId = node.id
          this.connect(prev, node)
          prev = node
        }
      }
    }

    // 始终创建 END 节点
    const endNode = this.createNode('end', '结束', 80)
    this.connect(prev, endNode)
  }

  private newId(): string {
    return 'node_' + ++this.idCounter
  }

  private createNode(
    type: FlowNodeType,
    label: string,
    width?: number,
    statement?: Statement
  ): FlowNode {
    let nodeWidth: number

    if (type === 'fg-merge') {
      nodeWidth = 20
    } else {
      // 精确测量文本渲染宽度（替代 label.length * 8）
      const fontSize = 13
      const fontWeight = (type === 'start' || type === 'end') ? '600' : 'normal'
      const textW = measureTextWidth(label, fontSize, fontWeight)

      // clip-path 形状（菱形/六边形）需要放大宽度
      const factor = SHAPE_WIDTH_FACTOR[type] ?? 1.0
      const rawW = textW * factor + NODE_PAD_X

      // 夹紧到 [MIN_W, MAX_W]，允许调用方显式传入 width
      nodeWidth = width ?? Math.min(Math.max(rawW, this.params.MIN_W), NODE_MAX_W)
    }

    const node: FlowNode = {
      id: this.newId(),
      type,
      position: { x: 0, y: 0 },
      data: {
        label,
        width: nodeWidth,
        height: this.params.NODE_H,
        statement,
        isEmpty: statement ? isStatementEmpty(statement) : false,
      },
    }
    this.nodes.push(node)
    this.nodesMap.set(node.id, node)
    return node
  }

  private connect(
    from: FlowNode,
    to: FlowNode,
    opts?: { sourceHandle?: string | null; targetHandle?: string | null }
  ): void {
    const sh = opts?.sourceHandle
    const th = opts?.targetHandle
    this.edges.push({
      id: `edge_${from.id}_${to.id}${sh ? '_' + sh : ''}${th ? '_' + th : ''}`,
      source: from.id,
      target: to.id,
      sourceHandle: sh,
      targetHandle: th,
      type: sh || th ? 'step' : 'default',
      markerEnd: { type: 'arrowclosed', color: 'context-stroke' } as EdgeMarkerType
    })
  }

  /**
   * 在指定 edge 处插入一个新节点：先修改 AST → 再重建 engine
   */
  insertNodeAtEdge(edgeId: string, statementKind: Statement['kind']): Statement | null {
    const edge = this.edges.find(e => e.id === edgeId)
    if (!edge) return null

    const sourceNode = this.nodesMap.get(edge.source)
    const targetNode = this.nodesMap.get(edge.target)
    if (!sourceNode || !targetNode) return null

    const newStmt = createDefaultStatement(statementKind)
    const mainFunc = this.program.functions.find(f => f.name === 'Main')
    if (!mainFunc) return null

    // ---- 判断 AST 插入位置 ----

    if (sourceNode.type === 'start') {
      // Start → 第一个节点：插入到 Main body 开头
      mainFunc.body.unshift(newStmt)
    } else if (targetNode.type === 'end') {
      // 最后一个节点 → End：插入到 Main body 末尾
      mainFunc.body.push(newStmt)
    } else if (sourceNode.type === 'fg-if') {
      // if 节点 → 空分支：插入到对应分支开头
      const ifStmt = sourceNode.data.statement as IfStatement | undefined
      if (ifStmt) {
        if (edge.sourceHandle === 'then') {
          ifStmt.thenBranch.unshift(newStmt)
        } else if (edge.sourceHandle === 'else') {
          ifStmt.elseBranch.unshift(newStmt)
        } else {
          mainFunc.body.push(newStmt) // 兜底
        }
      }
    } else if (sourceNode.type === 'fg-for' && edge.sourceHandle === 'loop-body') {
      // for 节点 → 循环体：插入到 body 开头
      const forStmt = sourceNode.data.statement as ForStatement | undefined
      if (forStmt) {
        forStmt.body.unshift(newStmt)
      }
    } else if (sourceNode.type === 'fg-while' && edge.sourceHandle === 'loop-body') {
      // while 节点 → 循环体：插入到 body 开头
      const whileStmt = sourceNode.data.statement as WhileStatement | undefined
      if (whileStmt) {
        whileStmt.body.unshift(newStmt)
      }
    } else if (sourceNode.data.statement) {
      // 普通顺序边：在 source 语句之后插入
      const loc = findStatementLocation(this.program, sourceNode.data.statement)
      if (loc) {
        loc.body.splice(loc.index + 1, 0, newStmt)
      } else {
        mainFunc.body.push(newStmt) // 兜底
      }
    } else {
      // 兜底：插入到 Main body 末尾
      mainFunc.body.push(newStmt)
    }

    // 重建整个 nodes/edges 图并重新排版
    this.rebuild()
    return newStmt
  }

  /** 清除旧数据并重新从 AST 构建 nodes/edges */
  rebuild(): void {
    this.nodes.length = 0
    this.edges.length = 0
    this.nodesMap.clear()
    this.idCounter = 0
    this.initGraph()
    this.layoutFlowchart()
  }

  /**
   * 递归处理一组语句，返回 [首节点, 尾节点]
   * 遇 if 语句则深度优先地构建子图（if-node → branches → merge-node）
   */
  private processSequence(statements: Statement[]): [FlowNode, FlowNode] {
    let first: FlowNode | null = null
    let prev: FlowNode | null = null

    for (const stmt of statements) {
      if (stmt.kind === 'if') {
        const [ifNode, mergeNode] = this.buildIfStatement(stmt, prev)
        if (!first) first = ifNode
        prev = mergeNode
      } else if (stmt.kind === 'for') {
        const forNode = this.buildForStatement(stmt, prev)
        if (!first) first = forNode
        prev = forNode
      } else if (stmt.kind === 'while') {
        const whileNode = this.buildWhileStatement(stmt, prev)
        if (!first) first = whileNode
        prev = whileNode
      } else {
        const nodeType = KIND_TO_NODE_TYPE[stmt.kind] ?? 'default'
        const label = statementToLabel(stmt)
        const node = this.createNode(nodeType, label, undefined, stmt)
        stmt._nodeId = node.id
        if (prev) this.connect(prev, node)
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
  private processBranch(
    statements: Statement[],
    fromNode: FlowNode,
    fromHandle: string,
    toNode: FlowNode,
    toHandle: string
  ): void {
    if (statements.length === 0) {
      this.connect(fromNode, toNode, {
        sourceHandle: fromHandle,
        targetHandle: toHandle
      })
      return
    }
    const [first, last] = this.processSequence(statements)
    this.connect(fromNode, first, { sourceHandle: fromHandle })
    this.connect(last, toNode, { targetHandle: toHandle })
  }

  /**
   * 构建 if 判断节点 + 汇集点，递归处理 then/else 分支
   * 返回 [ifNode, mergeNode]（首节点 + 尾节点）
   */
  private buildIfStatement(
    stmt: IfStatement & { _nodeId?: string },
    prevNode: FlowNode | null
  ): [FlowNode, FlowNode] {
    const ifNode = this.createNode('fg-if', stmt.expression, undefined, stmt)
    stmt._nodeId = ifNode.id
    if (prevNode) this.connect(prevNode, ifNode)

    const mergeNode = this.createNode('fg-merge', '', 20)
    mergeNode.data.ifNodeId = ifNode.id

    this.processBranch(stmt.thenBranch, ifNode, 'then', mergeNode, 'then-in')
    this.processBranch(stmt.elseBranch, ifNode, 'else', mergeNode, 'else-in')

    return [ifNode, mergeNode]
  }

  /**
   * 构建 for 循环节点，递归处理 body
   * 返回 forNode（自身作为出口，Bottom source 连下一条语句）
   */
  private buildForStatement(
    stmt: ForStatement & { _nodeId?: string },
    prevNode: FlowNode | null
  ): FlowNode {
    const label = statementToLabel(stmt)
    const forNode = this.createNode('fg-for', label, undefined, stmt)
    stmt._nodeId = forNode.id
    if (prevNode) this.connect(prevNode, forNode)

    // body 从 loop-body(Right source) 出 → loop-back(Bottom target) 回
    this.processBranch(stmt.body, forNode, 'loop-body', forNode, 'loop-back')

    return forNode
  }

  /**
   * 构建 while 循环节点，递归处理 body
   * 返回 whileNode（自身作为出口，Bottom source 连下一条语句）
   */
  private buildWhileStatement(
    stmt: WhileStatement & { _nodeId?: string },
    prevNode: FlowNode | null
  ): FlowNode {
    const label = statementToLabel(stmt)
    const whileNode = this.createNode('fg-while', label, undefined, stmt)
    stmt._nodeId = whileNode.id
    if (prevNode) this.connect(prevNode, whileNode)

    // body 从 loop-body(Right source) 出 → loop-back(Bottom target) 回
    this.processBranch(stmt.body, whileNode, 'loop-body', whileNode, 'loop-back')

    return whileNode
  }

  // ==========================================
  // Phase 2: Layout
  // ==========================================

  /**
   * 根据 ifNodeId 查找对应的 merge 节点
   */
  private findMergeNode(ifNodeId: string): FlowNode | undefined {
    for (const node of this.nodesMap.values()) {
      if (node.type === 'fg-merge' && node.data.ifNodeId === ifNodeId) return node
    }
  }

  private makeExtents(left: number, right: number): Extents {
    return { leftExtent: left, rightExtent: right, totalWidth: left + right }
  }

  /**
   * 纯测量：递归计算一组语句的左右拓展（不设 position）
   */
  private measureExtents(statements: Statement[]): Extents {
    let left = 0
    let right = 0

    for (const stmt of statements) {
      if (stmt.kind === 'if') {
        const ifNode = this.nodesMap.get(stmt._nodeId!)
        const ifW = ifNode?.data.width ?? this.params.IF_NODE_MIN_W
        const thenE = this.measureExtents(stmt.thenBranch)
        const elseE = this.measureExtents(stmt.elseBranch)
        const blockRight = Math.max(ifW / 2, ifW / 2 + this.params.BRANCH_H_GAP + thenE.totalWidth)
        const blockLeft = Math.max(ifW / 2, ifW / 2 + this.params.BRANCH_H_GAP + elseE.totalWidth)
        left = Math.max(left, blockLeft)
        right = Math.max(right, blockRight)
      } else if (stmt.kind === 'for') {
        const forNode = this.nodesMap.get(stmt._nodeId!)
        const forW = forNode?.data.width ?? this.params.FOR_NODE_MIN_W
        const bodyE = this.measureExtents(stmt.body)
        const blockRight = Math.max(
          forW / 2,
          forW / 2 + this.params.BRANCH_H_GAP + bodyE.totalWidth
        )
        left = Math.max(left, forW / 2)
        right = Math.max(right, blockRight)
      } else if (stmt.kind === 'while') {
        const whileNode = this.nodesMap.get(stmt._nodeId!)
        const whileW = whileNode?.data.width ?? this.params.WHILE_NODE_MIN_W
        const bodyE = this.measureExtents(stmt.body)
        const blockRight = Math.max(
          whileW / 2,
          whileW / 2 + this.params.BRANCH_H_GAP + bodyE.totalWidth
        )
        left = Math.max(left, whileW / 2)
        right = Math.max(right, blockRight)
      } else {
        const node = this.nodesMap.get(stmt._nodeId!)
        const w = (node?.data.width ?? 100) / 2
        left = Math.max(left, w)
        right = Math.max(right, w)
      }
    }

    return this.makeExtents(left, right)
  }

  /**
   * 递归排版一组语句（序列）
   */
  private layoutBlock(statements: Statement[], centerX: number, startY: number): LayoutResult {
    let cursor = startY
    let maxW = 0

    for (const stmt of statements) {
      if (stmt.kind === 'if') {
        const result = this.layoutIfSelection(stmt, centerX, cursor)
        cursor = result.endY
        maxW = Math.max(maxW, result.width)
      } else if (stmt.kind === 'for') {
        const result = this.layoutForSelection(stmt, centerX, cursor)
        cursor = result.endY
        maxW = Math.max(maxW, result.width)
      } else if (stmt.kind === 'while') {
        const result = this.layoutWhileSelection(stmt, centerX, cursor)
        cursor = result.endY
        maxW = Math.max(maxW, result.width)
      } else {
        const node = this.nodesMap.get(stmt._nodeId!)
        if (node) {
          const w = node.data.width ?? 100
          maxW = Math.max(maxW, w)
          node.position = { x: centerX - w / 2, y: cursor }
          cursor += this.params.NODE_H + this.params.SPACING
        }
      }
    }

    return { endY: cursor, width: maxW }
  }

  /**
   * 排版 if 语句（仿 flowgorithm.js drawSelection）
   */
  private layoutIfSelection(
    stmt: IfStatement & { _nodeId?: string },
    centerX: number,
    startY: number
  ): LayoutResult {
    const ifNode = this.nodesMap.get(stmt._nodeId!)
    if (!ifNode) return { endY: startY, width: 0 }

    const ifW = ifNode.data.width ?? this.params.IF_NODE_MIN_W

    // 1. 放置 if 菱形节点
    ifNode.position = { x: centerX - ifW / 2, y: startY }
    const branchStartY = startY + this.params.IF_NODE_H + this.params.BRANCH_V_GAP

    // 2. 测量并排版 then 分支
    const thenExtents = this.measureExtents(stmt.thenBranch)
    const thenCenterX = centerX + ifW / 2 + this.params.BRANCH_H_GAP + thenExtents.leftExtent
    const thenResult = this.layoutBlock(stmt.thenBranch, thenCenterX, branchStartY)

    // 3. 测量并排版 else 分支
    const elseExtents = this.measureExtents(stmt.elseBranch)
    const elseCenterX = centerX - ifW / 2 - this.params.BRANCH_H_GAP - elseExtents.rightExtent
    const elseResult = this.layoutBlock(stmt.elseBranch, elseCenterX, branchStartY)

    // 4. 以实际排版结果的分支宽度为准
    const totalWidth = ifW + this.params.BRANCH_H_GAP * 2 + thenResult.width + elseResult.width

    // 5. merge 节点在较深分支下方居中
    const maxBranchEndY = Math.max(thenResult.endY, elseResult.endY)
    const mergeNode = this.findMergeNode(ifNode.id)
    if (mergeNode) {
      mergeNode.position = {
        x: centerX - this.params.MERGE_NODE_W / 2,
        y: maxBranchEndY + this.params.BRANCH_V_GAP
      }
    }

    return {
      endY:
        maxBranchEndY + this.params.MERGE_NODE_H + this.params.BRANCH_V_GAP + this.params.SPACING,
      width: totalWidth
    }
  }

  /**
   * 排版 for 语句
   */
  private layoutForSelection(
    stmt: ForStatement & { _nodeId?: string },
    centerX: number,
    startY: number
  ): LayoutResult {
    const forNode = this.nodesMap.get(stmt._nodeId!)
    if (!forNode) return { endY: startY, width: 0 }

    const forW = forNode.data.width ?? this.params.FOR_NODE_MIN_W
    const forH = forNode.data.height ?? this.params.FOR_NODE_H

    // 1. 放置 for 六边形节点
    forNode.position = { x: centerX - forW / 2, y: startY }

    // 2. 测量并排版 body
    const bodyExtents = this.measureExtents(stmt.body)
    const bodyCenterX = centerX + forW / 2 + this.params.BRANCH_H_GAP + bodyExtents.leftExtent
    const bodyStartY = startY + forH + this.params.BRANCH_V_GAP
    const bodyResult = this.layoutBlock(stmt.body, bodyCenterX, bodyStartY)

    const totalWidth = forW + this.params.BRANCH_H_GAP + bodyResult.width
    const endY = Math.max(startY + forH, bodyResult.endY) + this.params.SPACING

    return { endY, width: totalWidth }
  }

  /**
   * 排版 while 语句
   */
  private layoutWhileSelection(
    stmt: WhileStatement & { _nodeId?: string },
    centerX: number,
    startY: number
  ): LayoutResult {
    const whileNode = this.nodesMap.get(stmt._nodeId!)
    if (!whileNode) return { endY: startY, width: 0 }

    const whileW = whileNode.data.width ?? this.params.WHILE_NODE_MIN_W
    const whileH = whileNode.data.height ?? this.params.WHILE_NODE_H

    // 1. 放置 while 六边形节点
    whileNode.position = { x: centerX - whileW / 2, y: startY }

    // 2. 测量并排版 body
    const bodyExtents = this.measureExtents(stmt.body)
    const bodyCenterX = centerX + whileW / 2 + this.params.BRANCH_H_GAP + bodyExtents.leftExtent
    const bodyStartY = startY + whileH + this.params.BRANCH_V_GAP
    const bodyResult = this.layoutBlock(stmt.body, bodyCenterX, bodyStartY)

    const totalWidth = whileW + this.params.BRANCH_H_GAP + bodyResult.width
    const endY = Math.max(startY + whileH, bodyResult.endY) + this.params.SPACING

    return { endY, width: totalWidth }
  }

  /**
   * 流程入口排版：START → Main body → END
   */
  private layoutFlowchart(): void {
    // 查找 START/END 节点
    let startNode: FlowNode | undefined
    let endNode: FlowNode | undefined
    for (const node of this.nodesMap.values()) {
      if (node.type === 'start') startNode = node
      if (node.type === 'end') endNode = node
    }

    // 放置 START
    const startX = this.params.FLOW_CENTER_X - this.params.START_W / 2
    if (startNode) {
      startNode.position = { x: startX, y: this.params.START_Y }
    }

    // 递归排版 Main body（可能为空）
    const mainFunc = this.program.functions.find(f => f.name === 'Main')
    const bodyStartY = this.params.START_Y + this.params.START_END_H + this.params.SPACING
    const bodyResult = mainFunc
      ? this.layoutBlock(mainFunc.body, this.params.FLOW_CENTER_X, bodyStartY)
      : { endY: bodyStartY, width: 0 }

    // 放置 END
    if (endNode) {
      endNode.position = { x: startX, y: bodyResult.endY }
    }
  }
}
