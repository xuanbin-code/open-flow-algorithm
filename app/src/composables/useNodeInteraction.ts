// ============================================================
// useNodeInteraction.ts — 节点交互 composable
//
// 管理节点/边的点击、选中、编辑、删除、上下文菜单、
// 插入节点面板等所有节点交互逻辑。
// ============================================================

import { ref, type Ref, type ComputedRef } from 'vue'
import {
  findStatementLocation,
  type Program,
  type Statement,
  type DeclareStatement,
} from '../engine/fprgAst'
import { FlowchartEngine, type FlowNode, type FlowEdge } from '../engine/flowchartEngine'

export interface UseNodeInteractionOptions {
  engine: Ref<FlowchartEngine>
  nodes: Ref<FlowNode[]>
  edges: Ref<FlowEdge[]>
  program: Ref<Program>
  isExecuting: ComputedRef<boolean>
  selectedNodeId: Ref<string | null>
  rebuildEngine: () => void
}

export function useNodeInteraction(options: UseNodeInteractionOptions) {
  const {
    engine,
    nodes,
    edges,
    program,
    isExecuting,
    selectedNodeId,
    rebuildEngine,
  } = options

  // ============================================
  // 面板状态
  // ============================================
  const panelVisible = ref(false)
  const panelPosition = ref({ x: 0, y: 0 })
  const contextMenuMousePos = ref({ x: 0, y: 0 })
  const clickedEdgeId = ref<string | null>(null)
  const editingStatement = ref<Statement | null>(null)

  // ============================================
  // 事件处理
  // ============================================

  function onEdgeClick(data: any) {
    if (isExecuting.value) return
    clickedEdgeId.value = data.edge.id
    panelPosition.value = { x: data.event.clientX + 24, y: data.event.clientY - 120 }
    panelVisible.value = true
  }

  function onNodeClick(data: any) {
    if (isExecuting.value) return
    selectedNodeId.value = data.node?.id ?? null
  }

  function onNodeDblClick(data: any) {
    if (isExecuting.value) return
    const stmt: Statement | undefined = data.node?.data?.statement
    if (!stmt) return
    selectedNodeId.value = data.node?.id ?? null
    clickedEdgeId.value = null
    editingStatement.value = stmt
    panelPosition.value = {
      x: data.event.clientX + 24,
      y: data.event.clientY - 120,
    }
    panelVisible.value = true
  }

  function onPaneClick() {
    if (isExecuting.value) return
    selectedNodeId.value = null
  }

  function onNodeContextMenu(event: MouseEvent) {
    contextMenuMousePos.value = { x: event.clientX, y: event.clientY }
  }

  function handleNodeContextEdit(nodeId: string) {
    if (isExecuting.value) return
    const node = engine.value.nodesMap.get(nodeId)
    if (!node?.data?.statement) return

    selectedNodeId.value = nodeId
    clickedEdgeId.value = null
    editingStatement.value = node.data.statement
    panelPosition.value = {
      x: contextMenuMousePos.value.x + 24,
      y: contextMenuMousePos.value.y - 120,
    }
    panelVisible.value = true
  }

  // ============================================
  // CRUD 操作
  // ============================================

  function deleteSelectedNode() {
    if (isExecuting.value) return
    const nodeId = selectedNodeId.value
    if (!nodeId) return
    const node = engine.value.nodesMap.get(nodeId)
    if (!node?.data?.statement) return

    const stmt = node.data.statement

    if (stmt.kind === 'declare' && (stmt as DeclareStatement).tag) {
      return
    }

    const loc = findStatementLocation(program.value, stmt)
    if (!loc) {
      console.warn('[deleteSelectedNode] 无法在 AST 中定位语句，放弃删除')
      return
    }
    loc.body.splice(loc.index, 1)
    selectedNodeId.value = null
    rebuildEngine()
  }

  function deleteNodeById(nodeId: string) {
    if (isExecuting.value) return
    const node = engine.value.nodesMap.get(nodeId)
    if (!node?.data?.statement) return

    const stmt = node.data.statement
    if (stmt.kind === 'declare' && (stmt as DeclareStatement).tag) return

    const loc = findStatementLocation(program.value, stmt)
    if (!loc) {
      console.warn('[deleteNodeById] 无法在 AST 中定位语句，放弃删除')
      return
    }
    loc.body.splice(loc.index, 1)
    if (selectedNodeId.value === nodeId) {
      selectedNodeId.value = null
    }
    rebuildEngine()
  }

  function canDeleteNode(nodeProps: any): boolean {
    if (isExecuting.value) return false
    const stmt = nodeProps.data?.statement as Statement | undefined
    if (!stmt) return false
    if (stmt.kind === 'declare' && (stmt as DeclareStatement).tag) return false
    return true
  }

  function canEditNode(nodeProps: any): boolean {
    if (isExecuting.value) return false
    return !!nodeProps.data?.statement
  }

  function onInsertNode(type: string) {
    if (clickedEdgeId.value) {
      const newStmt = engine.value.insertNodeAtEdge(clickedEdgeId.value, type as Statement['kind'])
      nodes.value = [...engine.value.nodes]
      edges.value = [...engine.value.edges]
      if (newStmt) {
        editingStatement.value = newStmt
      }
      console.log(`Inserted "${type}" at edge ${clickedEdgeId.value}, nodes: ${nodes.value.length}`)
    }
  }

  function onUpdateProperty(_stmt: Statement) {
    if (isExecuting.value) return
    rebuildEngine()
  }

  function onCloseEditor() {
    editingStatement.value = null
    panelVisible.value = false
    selectedNodeId.value = null
    rebuildEngine()
  }

  return {
    panelVisible,
    panelPosition,
    contextMenuMousePos,
    clickedEdgeId,
    editingStatement,
    onEdgeClick,
    onNodeClick,
    onNodeDblClick,
    onPaneClick,
    onNodeContextMenu,
    handleNodeContextEdit,
    deleteSelectedNode,
    deleteNodeById,
    canDeleteNode,
    canEditNode,
    onInsertNode,
    onUpdateProperty,
    onCloseEditor,
  }
}
