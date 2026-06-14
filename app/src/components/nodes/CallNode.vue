<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface CallNodeProps {
  id: string
  data?: {
    label?: string
    width?: number
    height?: number
    isEmpty?: boolean
    executing?: boolean
    flashHighlight?: boolean
  }
  selected?: boolean
  dragging?: boolean
}

const props = withDefaults(defineProps<CallNodeProps>(), {
  selected: false,
  dragging: false,
})

const nodeWidth = computed(() => props.data?.width ?? 100)
const nodeHeight = computed(() => props.data?.height ?? 50)
const label = computed(() => props.data?.label ?? '')
const isEmpty = computed(() => props.data?.isEmpty ?? false)
const executing = computed(() => props.data?.executing ?? false)
const flashHighlight = computed(() => props.data?.flashHighlight ?? false)
</script>

<template>
  <div
    class="flow-node fg-call-node"
    :class="{ selected, dragging, executing, flashHighlight, 'is-empty': isEmpty }"
    :style="{
      width: nodeWidth + 'px',
      height: nodeHeight + 'px',
    }"
  >
    <!-- 左侧双竖线装饰 -->
    <span class="call-sidebar call-sidebar-left" />
    <!-- 右侧双竖线装饰 -->
    <span class="call-sidebar call-sidebar-right" />
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
.flow-node {
  display: flex;
  position: relative;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border: 2px solid #6c3483;
}

.fg-call-node {
  background: #8e44ad;
  border-color: #6c3483;
}

/* ---- Call 节点特有的双竖线装饰（Flowgorithm 经典样式）---- */
.call-sidebar {
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: rgba(255, 255, 255, 0.3);
  pointer-events: none;
}

.call-sidebar-left {
  left: 6px;
}

.call-sidebar-right {
  right: 6px;
}

.node-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 14px;
}

.fg-call-node.selected {
  box-shadow: 0 0 0 3px rgba(142, 68, 173, 0.5);
}

.fg-call-node.executing {
  animation: call-exec-pulse 0.8s ease-in-out infinite alternate;
  border-color: #2ecc71 !important;
}

@keyframes call-exec-pulse {
  from {
    box-shadow: 0 0 8px rgba(46, 204, 113, 0.6), 0 0 16px rgba(46, 204, 113, 0.3);
  }
  to {
    box-shadow: 0 0 16px rgba(46, 204, 113, 0.9), 0 0 32px rgba(46, 204, 113, 0.5);
  }
}

.fg-call-node.dragging {
  opacity: 0.8;
  cursor: grabbing;
}

.fg-call-node.is-empty {
  opacity: 0.6;
  filter: grayscale(0.7);
}

.fg-call-node.flashHighlight {
  animation: call-flash-pulse 0.5s ease-in-out 3;
  border-color: var(--accent-orange, #f39c12) !important;
}

@keyframes call-flash-pulse {
  0%, 100% { box-shadow: 0 0 6px rgba(243, 156, 18, 0.4); }
  50%      { box-shadow: 0 0 20px rgba(243, 156, 18, 0.9), 0 0 36px rgba(243, 156, 18, 0.4); }
}
</style>
