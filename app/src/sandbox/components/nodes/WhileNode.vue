<script setup lang="ts">
import { computed, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface WhileNodeProps {
  id: string
  data?: {
    label?: string
    width?: number
    height?: number
    isEmpty?: boolean
    executing?: boolean
  }
  selected?: boolean
  dragging?: boolean
}

const props = withDefaults(defineProps<WhileNodeProps>(), {
  selected: false,
  dragging: false,
})

const nodeWidth = computed(() => props.data?.width ?? 160)
const nodeHeight = computed(() => props.data?.height ?? 80)
const label = computed(() => props.data?.label ?? '')
const isEmpty = computed(() => props.data?.isEmpty ?? false)
const executing = computed(() => props.data?.executing ?? false)

watch(
  () => props.data?.executing,
  (newVal, oldVal) => {
    console.log(`[WhileNode ${props.id}] executing changed: ${oldVal} → ${newVal}`)
  }
)
</script>

<template>
  <div
    class="flow-node while-node"
    :class="{ selected, dragging, executing, 'is-empty': isEmpty }"
    :style="{
      width: nodeWidth + 'px',
      height: nodeHeight + 'px',
    }"
  >
    <div class="node-shape"></div>
    <!-- 1. 顶部入口：接收上一条语句的连线 -->
    <Handle type="target" :position="Position.Top" />

    <!-- 2. 底部出口：循环结束后连接下一条语句 -->
    <Handle type="source" :position="Position.Bottom" />

    <!-- 3. 底部偏右：接收循环体末尾回指的自环连线 -->
    <Handle id="loop-back" type="target" :position="Position.Bottom" class="handle-loop-back" />

    <!-- 4. 右侧居中：指向循环体内首节点 -->
    <Handle id="loop-body" type="source" :position="Position.Right" />

    <span class="while-label">{{ label }}</span>
  </div>
</template>

<style scoped>
.flow-node {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

/* 形状层：承载 clip-path / 背景 / 边框 / 阴影，避免裁剪 Handle 与执行光晕 */
.node-shape {
  position: absolute;
  inset: 0;
  z-index: 0;
  clip-path: polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%);
}

.while-node .node-shape {
  background: #f1c40f;
  border: 2px solid #d4ac0d;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.while-label {
  position: relative;
  z-index: 1;
  max-width: 60%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.while-node.selected .node-shape {
  box-shadow: 0 0 0 3px rgba(241, 196, 15, 0.5);
}

.while-node.executing {
  animation: exec-pulse 0.8s ease-in-out infinite alternate;
}
.while-node.executing .node-shape {
  border-color: #2ecc71 !important;
}

.while-node.dragging {
  opacity: 0.8;
  cursor: grabbing;
}

.while-node.is-empty {
  opacity: 0.6;
  filter: grayscale(0.7);
}

@keyframes exec-pulse {
  from { filter: drop-shadow(0 0 6px rgba(46, 204, 113, 0.7)); }
  to   { filter: drop-shadow(0 0 18px rgba(46, 204, 113, 1)); }
}

/* loop-back handle 偏移到 center-bottom source 右边 20px */
:deep(.handle-loop-back) {
  left: calc(50% + 20px) !important;
}
</style>
