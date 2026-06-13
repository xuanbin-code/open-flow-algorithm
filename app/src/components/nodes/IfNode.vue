<script setup lang="ts">
import { computed, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface IfNodeProps {
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

const props = withDefaults(defineProps<IfNodeProps>(), {
  selected: false,
  dragging: false
})
watch(
  () => props.data?.executing,
  (newVal, oldVal) => {
    console.log(`[IfNode ${props.id}] executing changed: ${oldVal} → ${newVal}, data=`, props.data)
  }
)
const nodeWidth = computed(() => props.data?.width ?? 160)
const nodeHeight = computed(() => props.data?.height ?? 80)
const label = computed(() => props.data?.label ?? '')
const isEmpty = computed(() => props.data?.isEmpty ?? false)
const executing = computed(() => props.data?.executing ?? false)
const flashHighlight = computed(() => props.data?.flashHighlight ?? false)
</script>

<template>
  <div
    class="flow-node if-node"
    :class="{ selected, dragging, executing, flashHighlight, 'is-empty': isEmpty }"
    :style="{
      width: nodeWidth + 'px',
      height: nodeHeight + 'px'
    }"
  >
    <div class="node-shape-border"></div>
    <div class="node-shape"></div>
    <Handle type="target" :position="Position.Top" />
    <span class="if-label">{{ label }}</span>
    <Handle id="else" type="source" :position="Position.Left" />
    <span class="handle-tag else-tag">{{ $t('nodes.handle.false') }}</span>
    <Handle id="then" type="source" :position="Position.Right" />
    <span class="handle-tag then-tag">{{ $t('nodes.handle.true') }}</span>
  </div>
</template>

<style scoped>
.flow-node {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

/* 形状层：承载 clip-path / 背景 / 阴影，避免裁剪 Handle 与执行光晕 */
.node-shape-border,
.node-shape {
  position: absolute;
  z-index: 0;
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
}

.node-shape-border {
  inset: -2px;
  z-index: -1;
}

.node-shape {
  inset: 0;
}

.if-node .node-shape-border {
  background: #e67e22;
}

.if-node .node-shape {
  background: #f39c12;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.if-label {
  position: relative;
  z-index: 1;
  max-width: 55%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.if-node.selected .node-shape {
  box-shadow: 0 0 0 3px rgba(243, 156, 18, 0.5);
}

.if-node.executing {
  animation: exec-pulse-filter 0.8s ease-in-out infinite alternate;
}
.if-node.executing .node-shape-border {
  background: #2ecc71 !important;
}

.if-node.dragging {
  opacity: 0.8;
  cursor: grabbing;
}

.if-node.is-empty {
  opacity: 0.6;
  filter: grayscale(0.7);
}

/* handle 旁标签 */
.handle-tag {
  position: absolute;
  z-index: 2;
  font-size: 11px;
  font-weight: 600;
  pointer-events: none;
  white-space: nowrap;
}
.then-tag {
  color: var(--handle-label-color);
  right: -4px;
  top: 25%;
  transform: translate(100%, -50%);
}
.else-tag {
  color: var(--handle-label-color);
  left: -4px;
  top: 25%;
  transform: translate(-100%, -50%);
}


.if-node.flashHighlight {
  animation: flash-pulse-filter 0.5s ease-in-out 3;
}
.if-node.flashHighlight .node-shape-border {
  background: var(--accent-orange, #f39c12) !important;
}

</style>
