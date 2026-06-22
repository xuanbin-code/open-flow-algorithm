<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Undo2 } from '@/lib/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { BaseNodeProps } from '@/types'

const props = withDefaults(defineProps<BaseNodeProps>(), {
  selected: false,
  dragging: false,
})

const nodeWidth = computed(() => props.data?.width ?? 80)
const nodeHeight = computed(() => props.data?.height ?? 50)
const label = computed(() => props.data?.label ?? '')
const isEmpty = computed(() => props.data?.isEmpty ?? false)
const executing = computed(() => props.data?.executing ?? false)
const flashHighlight = computed(() => props.data?.flashHighlight ?? false)
</script>

<template>
  <div
    class="flow-node return-node"
    :class="{ selected, dragging, executing, flashHighlight, 'is-empty': isEmpty }"
    :style="{
      width: nodeWidth + 'px',
      height: nodeHeight + 'px',
    }"
  >
    <Handle type="target" :position="Position.Top" />
    <Undo2 :size="14" class="node-icon" />
    <Tooltip :delay-duration="500">
      <TooltipTrigger as-child>
        <span class="node-label">{{ label }}</span>
      </TooltipTrigger>
      <TooltipContent>
        {{ label }}
      </TooltipContent>
    </Tooltip>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<style scoped>
.flow-node {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: white;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border: 2px solid #a04030;
}

.return-node {
  background: #d35400;
  border-radius: 4px;
  border-color: #a04030;
}

.node-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.node-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 4px;
}

.return-node.selected {
  box-shadow: 0 0 0 3px rgba(211, 84, 0, 0.5);
}

.return-node.executing {
  animation: exec-pulse 0.8s ease-in-out infinite alternate;
  border-color: #2ecc71 !important;
}

.return-node.dragging {
  opacity: 0.8;
  cursor: grabbing;
}

.return-node.is-empty {
  opacity: 0.6;
  filter: grayscale(0.7);
}

.return-node.flashHighlight {
  animation: flash-pulse 0.5s ease-in-out 3;
  border-color: var(--accent-orange, #f39c12) !important;
}
</style>
