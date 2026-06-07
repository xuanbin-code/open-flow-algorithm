<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface EndNodeProps {
  id: string
  data?: {
    label?: string
    width?: number
    height?: number
  }
  selected?: boolean
  dragging?: boolean
}

const props = withDefaults(defineProps<EndNodeProps>(), {
  selected: false,
  dragging: false,
})

const nodeWidth = computed(() => props.data?.width ?? 80)
const nodeHeight = computed(() => props.data?.height ?? 50)
const label = computed(() => props.data?.label ?? 'END')
</script>

<template>
  <div
    class="flow-node end-node"
    :class="{ selected, dragging }"
    :style="{
      width: nodeWidth + 'px',
      height: nodeHeight + 'px',
    }"
  >
    {{ label }}
    <Handle type="target" :position="Position.Top" />
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
  border: 2px solid #c0392b;
}

.end-node {
  background: #e74c3c;
  border-radius: 50%;
  border-color: #c0392b;
}

.end-node.selected {
  box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.5);
}

.end-node.dragging {
  opacity: 0.8;
  cursor: grabbing;
}
</style>
