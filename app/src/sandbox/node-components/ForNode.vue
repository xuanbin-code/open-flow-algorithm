<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface ForNodeProps {
  id: string
  data?: {
    label?: string
    width?: number
    height?: number
  }
  selected?: boolean
  dragging?: boolean
}

const props = withDefaults(defineProps<ForNodeProps>(), {
  selected: false,
  dragging: false,
})

const nodeWidth = computed(() => props.data?.width ?? 160)
const nodeHeight = computed(() => props.data?.height ?? 80)
const label = computed(() => props.data?.label ?? '')
</script>

<template>
  <div
    class="flow-node for-node"
    :class="{ selected, dragging }"
    :style="{
      width: nodeWidth + 'px',
      height: nodeHeight + 'px',
    }"
  >
    <!-- 1. 顶部入口：接收上一条语句的连线 -->
    <Handle type="target" :position="Position.Top" />

    <!-- 2. 底部出口：循环结束后连接下一条语句 -->
    <Handle type="source" :position="Position.Bottom" />

    <!-- 3. 底部偏右：接收循环体末尾回指的自环连线 -->
    <Handle id="loop-back" type="target" :position="Position.Bottom" class="handle-loop-back" />

    <!-- 4. 右侧居中：指向循环体内首节点 -->
    <Handle id="loop-body" type="source" :position="Position.Right" />

    <span class="for-label">{{ label }}</span>
  </div>
</template>

<style scoped>
.flow-node {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  border: 2px solid #27ae60;
  clip-path: polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%);
}

.for-node {
  background: #2ecc71;
}

.for-label {
  max-width: 50%;
  text-align: center;
  word-break: break-all;
}

.for-node.selected {
  box-shadow: 0 0 0 3px rgba(46, 204, 113, 0.5);
}

.for-node.dragging {
  opacity: 0.8;
  cursor: grabbing;
}

/* loop-back handle 偏移到 center-bottom source 右边 20px */
:deep(.handle-loop-back) {
  left: calc(50% + 20px) !important;
}
</style>
