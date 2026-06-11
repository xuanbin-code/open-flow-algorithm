<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface StartNodeProps {
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

const props = withDefaults(defineProps<StartNodeProps>(), {
  selected: false,
  dragging: false,
})

const nodeWidth = computed(() => props.data?.width ?? 80)
const nodeHeight = computed(() => props.data?.height ?? 50)
const label = computed(() => props.data?.label ?? '开始')
const executing = computed(() => props.data?.executing ?? false)
// StartNode is never empty — it's always a fixed "开始" node
</script>

<template>
  <div
    class="flow-node start-node"
    :class="{ selected, dragging, executing }"
    :style="{
      width: nodeWidth + 'px',
      height: nodeHeight + 'px',
    }"
  >
    <span class="node-label">{{ label }}</span>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<style scoped>
.flow-node {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border: 2px solid #27ae60;
}

.start-node {
  background: #2ecc71;
  border-radius: 25px;
  border-color: #27ae60;
}

.node-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 8px;
}

.start-node.selected {
  box-shadow: 0 0 0 3px rgba(46, 204, 113, 0.5);
}

.start-node.executing {
  animation: exec-pulse 0.8s ease-in-out infinite alternate;
  border-color: #2ecc71 !important;
}

.start-node.dragging {
  opacity: 0.8;
  cursor: grabbing;
}

@keyframes exec-pulse {
  from { box-shadow: 0 0 8px rgba(46, 204, 113, 0.6), 0 0 16px rgba(46, 204, 113, 0.3); }
  to   { box-shadow: 0 0 16px rgba(46, 204, 113, 0.9), 0 0 32px rgba(46, 204, 113, 0.5); }
}
</style>
