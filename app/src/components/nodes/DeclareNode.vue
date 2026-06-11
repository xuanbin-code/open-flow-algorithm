<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface DeclareNodeProps {
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

const props = withDefaults(defineProps<DeclareNodeProps>(), {
  selected: false,
  dragging: false,
})

const nodeWidth = computed(() => props.data?.width ?? 140)
const nodeHeight = computed(() => props.data?.height ?? 50)
const label = computed(() => props.data?.label ?? '')
const isEmpty = computed(() => props.data?.isEmpty ?? false)
const executing = computed(() => props.data?.executing ?? false)
</script>

<template>
  <div
    class="flow-node declare-node"
    :class="{ selected, dragging, executing, 'is-empty': isEmpty }"
    :style="{
      width: nodeWidth + 'px',
      height: nodeHeight + 'px',
    }"
  >
    <Handle type="target" :position="Position.Top" />
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
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border: 2px solid #2980b9;
}

.declare-node {
  background: #3498db;
  border-radius: 4px;
  border-color: #2980b9;
}

.node-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 8px;
}

.declare-node.selected {
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.5);
}

.declare-node.executing {
  animation: exec-pulse 0.8s ease-in-out infinite alternate;
  border-color: #2ecc71 !important;
}

.declare-node.dragging {
  opacity: 0.8;
  cursor: grabbing;
}

.declare-node.is-empty {
  opacity: 0.6;
  filter: grayscale(0.7);
}

@keyframes exec-pulse {
  from { box-shadow: 0 0 8px rgba(46, 204, 113, 0.6), 0 0 16px rgba(46, 204, 113, 0.3); }
  to   { box-shadow: 0 0 16px rgba(46, 204, 113, 0.9), 0 0 32px rgba(46, 204, 113, 0.5); }
}
</style>
