<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VariableEntry } from '@/types'
import { GripVertical, ChevronRight, ExternalLink, Pin } from '../icons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ============================================================
// Props & Emits
// ============================================================

const { t } = useI18n()

const props = defineProps<{
  variables: VariableEntry[]
  visible: boolean
  mode: 'embedded' | 'window'
}>()

const emit = defineEmits<{
  toggleMode: []
}>()

// ============================================================
// Draggable state
// ============================================================

const panelLeft = ref(window.innerWidth - 420)
const panelTop = ref(90)
const collapsed = ref(false)
const dragging = ref(false)
const hasDragged = ref(false)
let dragStartX = 0
let dragStartY = 0
let panelStartX = 0
let panelStartY = 0

function onDragStart(e: MouseEvent) {
  if (props.mode !== 'window') return
  dragging.value = true
  hasDragged.value = false
  dragStartX = e.clientX
  dragStartY = e.clientY
  panelStartX = panelLeft.value
  panelStartY = panelTop.value
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: MouseEvent) {
  if (!dragging.value) return
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    hasDragged.value = true
  }
  panelLeft.value = panelStartX + dx
  panelTop.value = panelStartY + dy
}

function onDragEnd() {
  dragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

function onToggleClick() {
  if (hasDragged.value) return
  collapsed.value = !collapsed.value
}

// ============================================================
// Display helpers
// ============================================================

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return t('execution.nullValueShort')
  if (typeof value === 'boolean') return value ? t('execution.trueValueShort') : t('execution.falseValueShort')
  return String(value)
}
</script>

<template>
  <div
    v-if="visible"
    class="var-monitor"
    :class="{
      'var-monitor--embedded': mode === 'embedded',
      'var-monitor--window': mode === 'window',
      collapsed,
      dragging,
    }"
    :style="mode === 'window' ? { left: panelLeft + 'px', top: panelTop + 'px' } : undefined"
  >
    <Card
      :class="[
        mode === 'window'
          ? 'border-0 shadow-lg backdrop-blur-sm'
          : 'border-0 shadow-none',
        collapsed ? 'p-1' : '',
      ]"
    >
      <!-- Header -->
      <CardHeader
        class="flex-row items-center gap-1 space-y-0 px-2 py-1.5"
        :class="{ 'cursor-grab': mode === 'window' && !collapsed, 'active:cursor-grabbing': dragging }"
        @mousedown="onDragStart"
        @click="onToggleClick"
      >
        <GripVertical v-if="!collapsed" :size="12" class="text-muted-foreground" />
        <CardTitle v-if="!collapsed" class="text-xs font-semibold">
          {{ $t('execution.variables') }}
        </CardTitle>
        <Badge v-if="!collapsed" variant="secondary" class="text-[10px]">
          {{ props.variables.length }}
        </Badge>

        <!-- Mode toggle button (right-aligned, replaces former close button position) -->
        <Button
          v-if="!collapsed"
          variant="ghost"
          size="icon-sm"
          class="ml-auto"
          :title="mode === 'embedded' ? $t('panels.variableMonitor.popOut') : $t('panels.variableMonitor.dockIn')"
          @click.stop="emit('toggleMode')"
        >
          <ExternalLink v-if="mode === 'embedded'" :size="13" />
          <Pin v-else :size="13" />
        </Button>

        <ChevronRight
          v-if="collapsed"
          :size="14"
          class="text-muted-foreground"
        />
      </CardHeader>

      <!-- Body -->
      <template v-if="!collapsed">
        <CardContent class="p-0 var-monitor-body">
          <ScrollArea class="max-h-64 var-monitor-scroll">
            <Table v-if="props.variables.length > 0">
              <TableHeader>
                <TableRow>
                  <TableHead class="h-7 text-xs">{{ $t('execution.varName') }}</TableHead>
                  <TableHead class="h-7 text-xs">{{ $t('execution.varType') }}</TableHead>
                  <TableHead class="h-7 text-xs">{{ $t('execution.varValue') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(v, i) in props.variables" :key="i">
                  <TableCell class="py-1 text-xs font-mono">
                    <span class="inline-flex items-center gap-1">
                      {{ v.name }}
                      <Badge v-if="v.tag === 'return'" variant="default" class="tag-badge tag-badge--return">{{ $t('execution.varTagReturn') }}</Badge>
                      <Badge v-if="v.tag === 'parameter'" variant="secondary" class="tag-badge tag-badge--param">{{ $t('execution.varTagParameter') }}</Badge>
                    </span>
                  </TableCell>
                  <TableCell class="py-1 text-xs text-muted-foreground">{{ v.type }}</TableCell>
                  <TableCell class="py-1 text-xs font-mono">{{ formatValue(v.value) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div v-else class="px-4 py-6 text-center text-xs italic text-muted-foreground">
              {{ $t('execution.noVariablesShort') }}
            </div>
          </ScrollArea>
        </CardContent>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.var-monitor--window {
  position: fixed;
  z-index: 40;
  width: 350px;
  max-height: 400px;
}

.var-monitor--embedded {
  position: static;
  width: 100%;
  min-height: 120px;
  max-height: 250px;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  background: var(--bg-panel);
}

.var-monitor--embedded .var-monitor-scroll {
  max-height: none !important;
}

.var-monitor.collapsed {
  width: auto;
}

.var-monitor--embedded.collapsed {
  min-height: auto;
}

.var-monitor--window.collapsed {
  width: auto;
}

.var-monitor.dragging {
  opacity: 0.9;
}

.tag-badge {
  font-size: 9px;
  padding: 0 3px;
  height: 15px;
  line-height: 1;
}

.tag-badge--return {
  background: color-mix(in srgb, var(--accent-yellow, #f39c12) 75%, transparent) !important;
  color: #fff !important;
}

.tag-badge--param {
  background: color-mix(in srgb, var(--accent, #3498db) 40%, transparent) !important;
  color: var(--accent, #3498db) !important;
  border: 1px solid color-mix(in srgb, var(--accent, #3498db) 30%, transparent);
}
</style>
