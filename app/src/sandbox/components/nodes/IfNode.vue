<script setup lang="ts">
import { computed, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface IfNodeProps {
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

const props = withDefaults(defineProps<IfNodeProps>(), {
  selected: false,
  dragging: false
})
watch(
  () => props.data?.executing,
  (newVal, oldVal) => {
    console.log(`[IfNode ${props.id}] executing changed: ${oldVal} → ${newVal}, data=`, props.data)
  }
)
const nodeWidth = computed(() => props.data?.width ?? 160)
const nodeHeight = computed(() => props.data?.height ?? 80)
const label = computed(() => props.data?.label ?? '')
const isEmpty = computed(() => props.data?.isEmpty ?? false)
const executing = computed(() => props.data?.executing ?? false)
</script>

<template>
  <div
    class="flow-node if-node"
    :class="{ selected, dragging, executing, 'is-empty': isEmpty }"
    :style="{
      width: nodeWidth + 'px',
      height: nodeHeight + 'px'
    }"
  >
    <div class="node-shape"></div>
    <Handle type="target" :position="Position.Top" />
    <span class="if-label">{{ label }}</span>
    <Handle id="else" type="source" :position="Position.Left" />
    <Handle id="then" type="source" :position="Position.Right" />
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
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
}

.if-node .node-shape {
  background: #f39c12;
  border: 2px solid #e67e22;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.if-label {
  position: relative;
  z-index: 1;
  max-width: 55%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.if-node.selected .node-shape {
  box-shadow: 0 0 0 3px rgba(243, 156, 18, 0.5);
}

.if-node.executing {
  animation: exec-pulse 0.8s ease-in-out infinite alternate;
}
.if-node.executing .node-shape {
  border-color: #2ecc71 !important;
}

.if-node.dragging {
  opacity: 0.8;
  cursor: grabbing;
}

.if-node.is-empty {
  opacity: 0.6;
  filter: grayscale(0.7);
}

@keyframes exec-pulse {
  from { filter: drop-shadow(0 0 6px rgba(46, 204, 113, 0.7)); }
  to   { filter: drop-shadow(0 0 18px rgba(46, 204, 113, 1)); }
}
</style>
