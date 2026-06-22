<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { StopCircle } from '@/lib/icons'
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
    class="flow-node breakpoint-node"
    :class="{ selected, dragging, executing, flashHighlight, 'is-empty': isEmpty }"
    :style="{
      width: nodeWidth + 'px',
      height: nodeHeight + 'px',
    }"
  >
    <div class="node-shape-border"></div>
    <div class="node-shape"></div>
    <Handle type="target" :position="Position.Top" />
    <StopCircle :size="14" class="node-icon" />
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: white;
  font-size: 13px;
}

/* 两层 clip-path 技术：外层 = 边框，内层 = 填充 */
.node-shape-border,
.node-shape {
  position: absolute;
  z-index: 0;
  clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);
}

.node-shape-border {
  inset: -2px;
  z-index: -1;
  background: #c0392b;
}

.node-shape {
  inset: 0;
  background: #e74c3c;
}

.node-icon {
  flex-shrink: 0;
  opacity: 0.9;
  z-index: 1;
}

.node-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 4px;
  z-index: 1;
}

/* 选中态 */
.breakpoint-node.selected .node-shape-border {
  background: #fff;
}
.breakpoint-node.selected .node-shape {
  background: #e74c3c;
}

/* 执行中高亮（使用 filter 版，因为 clip-path 会裁剪 box-shadow） */
.breakpoint-node.executing .node-shape-border {
  animation: exec-pulse-filter 0.8s ease-in-out infinite alternate;
  background: #2ecc71;
}
.breakpoint-node.executing .node-shape {
  background: #35d07f;
}

/* 拖拽中 */
.breakpoint-node.dragging {
  opacity: 0.8;
  cursor: grabbing;
}

/* 空节点（未填写内容） */
.breakpoint-node.is-empty .node-shape {
  opacity: 0.6;
  filter: grayscale(0.7);
}

/* 闪烁高亮（从输出面板点击跳转） */
.breakpoint-node.flashHighlight .node-shape-border {
  animation: flash-pulse-filter 0.5s ease-in-out 3;
  background: #f39c12;
}
.breakpoint-node.flashHighlight .node-shape {
  background: #f6b44b;
}
</style>
