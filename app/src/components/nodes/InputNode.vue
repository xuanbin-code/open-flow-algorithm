<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
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
    class="flow-node fg-input-node"
    :class="{ selected, dragging, executing, flashHighlight, 'is-empty': isEmpty }"
    :style="{
      width: nodeWidth + 'px',
      height: nodeHeight + 'px',
    }"
  >
    <div class="node-shape"></div>
    <Handle type="target" :position="Position.Top" />
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
/* 形状层：承载 skewX 变换 / 背景 / 阴影，避免影响 Handle 定位 */
.node-shape {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: #e67e22;
  border: 2px solid #d35400;
  transform: skewX(-10deg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.flow-node {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 13px;
}

.node-label {
  position: relative;
  z-index: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 8px;
}

.fg-input-node.selected .node-shape {
  box-shadow: 0 0 0 3px rgba(230, 126, 34, 0.5);
}

.fg-input-node.executing .node-shape {
  animation: exec-pulse 0.8s ease-in-out infinite alternate;
  border-color: #2ecc71 !important;
}

.fg-input-node.dragging .node-shape {
  opacity: 0.8;
}

.fg-input-node.dragging {
  cursor: grabbing;
}

.fg-input-node.is-empty .node-shape {
  opacity: 0.6;
  filter: grayscale(0.7);
}

.fg-input-node.flashHighlight .node-shape {
  animation: flash-pulse 0.5s ease-in-out 3;
  border-color: var(--accent-orange, #f39c12) !important;
}

</style>
