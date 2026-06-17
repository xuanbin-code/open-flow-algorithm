// ============================================================
// Node Types — 共享的 VueFlow 节点属性类型
// ============================================================

/** 节点 data 对象中可能包含的字段 */
export interface FlowNodeData {
  label?: string
  width?: number
  height?: number
  isEmpty?: boolean
  executing?: boolean
  flashHighlight?: boolean
}

/** 所有自定义 VueFlow 节点的公共 props */
export interface BaseNodeProps {
  id: string
  data?: FlowNodeData
  selected?: boolean
  dragging?: boolean
}
