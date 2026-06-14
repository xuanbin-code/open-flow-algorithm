import { type Ref, nextTick } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import type { FlowNode } from '../engine/flowchart-engine'

export interface FitToStartOptions {
  zoom: number
  yOffset: number
}

/**
 * 视口定位 composable — 将 Start 节点定位在视图中
 *
 * 目标效果：
 * - Start 节点 X 轴（水平）居中在视口
 * - Start 节点 Y 轴距顶部 yOffset px
 * - 使用固定的 zoom 缩放比例（不自动适配所有节点）
 */
export function useViewportFit(nodes: Ref<FlowNode[]>) {
  const { setViewport } = useVueFlow()

  /** 获取 .vue-flow 容器的 DOMRect（供调试面板显示） */
  function getContainerRect(): DOMRect | null {
    const el = document.querySelector('.vue-flow') as HTMLElement | null
    return el?.getBoundingClientRect() ?? null
  }

  /** 将视口定位到 Start 节点 */
  async function fitToStartNode(options: FitToStartOptions) {
    const rect = getContainerRect()
    if (!rect) {
      console.warn('[fitToStartNode] Cannot find .vue-flow container element')
      return
    }

    const startNode = nodes.value.find(n => n.type === 'start')
    if (!startNode) {
      console.warn('[fitToStartNode] No start node found in current function')
      return
    }

    // 夹紧 zoom 到合法范围
    const zoom = Math.max(0.1, Math.min(4.0, options.zoom))

    // Start 节点中心在流程图坐标中的位置
    const nodeW = (startNode as any).data?.width ?? 80
    const nodeH = (startNode as any).data?.height ?? 50
    const flowCenterX = startNode.position.x + nodeW / 2
    const flowCenterY = startNode.position.y + nodeH / 2

    // 目标屏幕位置：X = 容器宽度 / 2（水平居中），Y = yOffset（距顶部）
    const targetScreenX = rect.width / 2
    const targetScreenY = options.yOffset

    // 反算视口坐标：screenXY = (flowXY + viewportXY) * zoom
    //          →  viewportXY = screenXY / zoom - flowXY
    const vpX = targetScreenX / zoom - flowCenterX
    const vpY = targetScreenY / zoom - flowCenterY

    await nextTick()
    setViewport({ zoom, x: Math.round(vpX), y: Math.round(vpY) }, { duration: 0 })
  }

  return { fitToStartNode, getContainerRect }
}
