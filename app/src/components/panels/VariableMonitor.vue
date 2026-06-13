<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { GripVertical, X, ChevronRight } from '../icons'
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
// Types
// ============================================================

export interface VariableEntry {
  name: string
  type: string
  value: unknown
}

// ============================================================
// Props & Emits
// ============================================================

const { t } = useI18n()

const props = defineProps<{
  variables: VariableEntry[]
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
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
    :class="{ collapsed, dragging }"
    :style="{ left: panelLeft + 'px', top: panelTop + 'px' }"
  >
    <Card class="border-0 shadow-lg backdrop-blur-sm" :class="collapsed ? 'p-1' : ''">
      <!-- Header -->
      <CardHeader
        class="flex-row items-center gap-1 space-y-0 px-2 py-1.5"
        :class="{ 'cursor-grab': !collapsed, 'active:cursor-grabbing': dragging }"
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
        <Button
          v-if="!collapsed"
          variant="ghost"
          size="icon-sm"
          class="ml-auto"
          @click.stop="emit('close')"
        >
          <X :size="13" />
        </Button>
        <ChevronRight
          v-if="collapsed"
          :size="14"
          class="text-muted-foreground"
        />
      </CardHeader>

      <!-- Body -->
      <template v-if="!collapsed">
        <CardContent class="p-0">
          <ScrollArea class="max-h-64">
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
                  <TableCell class="py-1 text-xs font-mono">{{ v.name }}</TableCell>
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
.var-monitor {
  position: fixed;
  z-index: 40;
  width: 350px;
  max-height: 400px;
}

.var-monitor.collapsed {
  width: auto;
}

.var-monitor.dragging {
  opacity: 0.9;
}
</style>
