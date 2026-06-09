<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface IfNodeProps {
  id: string
  data?: {
    label?: string
    width?: number
    height?: number
  }
  selected?: boolean
  dragging?: boolean
}

const props = withDefaults(defineProps<IfNodeProps>(), {
  selected: false,
  dragging: false,
})

const nodeWidth = computed(() => props.data?.width ?? 160)
const nodeHeight = computed(() => props.data?.height ?? 80)
const label = computed(() => props.data?.label ?? '')
</script>

<template>
  <div
    class="flow-node if-node"
    :class="{ selected, dragging }"
    :style="{
      width: nodeWidth + 'px',
      height: nodeHeight + 'px',
    }"
  >
    <Handle type="target" :position="Position.Top" />
    <span class="if-label">{{ label }}</span>
    <Handle id="else" type="source" :position="Position.Left" />
    <Handle id="then" type="source" :position="Position.Right" />
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
  border: 2px solid #e67e22;
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
}

.if-node {
  background: #f39c12;
}

.if-label {
  max-width: 55%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.if-node.selected {
  box-shadow: 0 0 0 3px rgba(243, 156, 18, 0.5);
}

.if-node.dragging {
  opacity: 0.8;
  cursor: grabbing;
}
</style>
