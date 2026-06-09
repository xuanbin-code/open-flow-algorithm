<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface InputNodeProps {
  id: string
  data?: {
    label?: string
    width?: number
    height?: number
    isEmpty?: boolean
  }
  selected?: boolean
  dragging?: boolean
}

const props = withDefaults(defineProps<InputNodeProps>(), {
  selected: false,
  dragging: false,
})

const nodeWidth = computed(() => props.data?.width ?? 80)
const nodeHeight = computed(() => props.data?.height ?? 50)
const label = computed(() => props.data?.label ?? '')
const isEmpty = computed(() => props.data?.isEmpty ?? false)
</script>

<template>
  <div
    class="flow-node fg-input-node"
    :class="{ selected, dragging, 'is-empty': isEmpty }"
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
  border: 2px solid #d35400;
  transform: skewX(-10deg);
}

.fg-input-node {
  background: #e67e22;
  border-color: #d35400;
}

.node-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 8px;
  transform: skewX(10deg);
}

.fg-input-node.selected {
  box-shadow: 0 0 0 3px rgba(230, 126, 34, 0.5);
}

.fg-input-node.dragging {
  opacity: 0.8;
  cursor: grabbing;
}

.fg-input-node.is-empty {
  opacity: 0.6;
  filter: grayscale(0.7);
}
</style>
