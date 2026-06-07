<script setup lang="ts">
import { computed } from 'vue'

interface DeclareNodeProps {
  id: string
  data?: {
    label?: string
    width?: number
    height?: number
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
</script>

<template>
  <div
    class="flow-node declare-node"
    :class="{ selected, dragging }"
    :style="{
      width: nodeWidth + 'px',
      height: nodeHeight + 'px',
    }"
  >
    {{ label }}
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
  border-left: 6px solid #1a252f;
}

.declare-node.selected {
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.5);
}

.declare-node.dragging {
  opacity: 0.8;
  cursor: grabbing;
}
</style>
