<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface MergeNodeProps {
  id: string
  data?: {
    isEmpty?: boolean
    executing?: boolean
    flashHighlight?: boolean
  }
  selected?: boolean
  dragging?: boolean
}

const props = withDefaults(defineProps<MergeNodeProps>(), {
  selected: false,
  dragging: false,
})

const executing = computed(() => props.data?.executing ?? false)
const flashHighlight = computed(() => props.data?.flashHighlight ?? false)
</script>

<template>
  <div
    class="flow-node merge-node"
    :class="{ selected, dragging, executing, flashHighlight }"
  >
    <Handle id="else-in" type="target" :position="Position.Left" />
    <Handle id="then-in" type="target" :position="Position.Right" />
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<style scoped>
.flow-node {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #2c3e50;
  border: 2px solid #1a252f;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.merge-node.selected {
  box-shadow: 0 0 0 3px rgba(44, 62, 80, 0.5);
}

.merge-node.executing {
  animation: exec-pulse 0.8s ease-in-out infinite alternate;
  border-color: #2ecc71 !important;
}

.merge-node.dragging {
  opacity: 0.8;
  cursor: grabbing;
}


.merge-node.flashHighlight {
  animation: flash-pulse 0.5s ease-in-out 3;
  border-color: var(--accent-orange, #f39c12) !important;
}

</style>
