<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Play } from '@/lib/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { FunctionDef } from '../../engine/fprgAst'

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  visible: boolean
  funcDef: FunctionDef | null
}>()

const emit = defineEmits<{
  confirm: [params: Record<string, unknown>]
  cancel: []
}>()

// ============================================================
// Parameter value state
// ============================================================

interface ParamInput {
  name: string
  value: string  // 存储为字符串，提交时按类型转换
  type: string
  array: boolean
}

const paramInputs = ref<ParamInput[]>([])

function initInputs() {
  if (!props.funcDef) {
    paramInputs.value = []
    return
  }
  paramInputs.value = props.funcDef.parameters.map((p) => ({
    name: p.name,
    value: defaultValueString(p.type),
    type: p.type,
    array: p.array,
  }))
}

function defaultValueString(type: string): string {
  switch (type) {
    case 'Integer': return '0'
    case 'Real': return '0.0'
    case 'Boolean': return 'false'
    case 'String': return ''
    default: return '0'  // unknown/empty type → default to numeric
  }
}

// 对话框打开时重置输入
watch(
  () => props.visible,
  async (v) => {
    if (v) {
      initInputs()
      await nextTick()
      // 聚焦第一个输入框
      const el = document.querySelector<HTMLInputElement>('[data-param-input]')
      el?.focus()
    }
  },
)

// ============================================================
// Type label helpers
// ============================================================

const typeLabels: Record<string, string> = {
  Integer: 'integer',
  Real: 'real',
  String: 'string',
  Boolean: 'boolean',
}

// ============================================================
// Submit / Cancel
// ============================================================

function onOpenChange(open: boolean) {
  if (!open) {
    emit('cancel')
  }
}

function onSubmit() {
  const params: Record<string, unknown> = {}
  for (const input of paramInputs.value) {
    params[input.name] = parseValue(input.value, input.type, input.array)
  }
  emit('confirm', params)
}

function parseValue(raw: string, type: string, _isArray: boolean): unknown {
  switch (type) {
    case 'Integer': {
      const n = Math.floor(Number(raw))
      return isNaN(n) ? 0 : n
    }
    case 'Real': {
      const n = Number(raw)
      return isNaN(n) ? 0.0 : n
    }
    case 'Boolean': {
      const lowered = raw.toLowerCase()
      return lowered === 'true' || lowered === '1' || lowered === '真'
    }
    default:
      return raw
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onSubmit()
  }
}
</script>

<template>
  <Dialog :open="visible" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Play :size="18" />
          <span>{{ $t('execution.executeFunction') }}: {{ funcDef?.name }}</span>
        </DialogTitle>
        <DialogDescription>
          {{ $t('execution.executeFunctionDesc', { name: funcDef?.name }) }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="paramInputs.length === 0" class="py-4 text-center text-sm text-muted-foreground">
        {{ $t('functions.noParameters') }}
      </div>

      <div v-else class="flex flex-col gap-3 py-2">
        <div
          v-for="input in paramInputs"
          :key="input.name"
          class="flex items-center gap-3"
        >
          <Label class="w-28 shrink-0 text-sm font-medium text-right">
            {{ input.name }}
            <span
              v-if="typeLabels[input.type]"
              class="text-xs text-muted-foreground ml-0.5"
            >
              ({{ $t('execution.' + typeLabels[input.type]) }})
            </span>
          </Label>
          <div class="flex-1 flex items-center gap-2">
            <!-- Integer / Real: number input -->
            <Input
              v-if="input.type === 'Integer' || input.type === 'Real'"
              v-model="input.value"
              data-param-input
              type="number"
              :step="input.type === 'Integer' ? '1' : 'any'"
              class="h-8 text-sm"
              @keydown="onKeydown"
            />
            <!-- String: text input -->
            <Input
              v-else-if="input.type === 'String'"
              v-model="input.value"
              data-param-input
              type="text"
              class="h-8 text-sm"
              @keydown="onKeydown"
            />
            <!-- Boolean: checkbox -->
            <div v-else-if="input.type === 'Boolean'" class="flex items-center gap-2 h-8">
              <Checkbox
                :checked="input.value === 'true'"
                @update:checked="(v: boolean) => input.value = v ? 'true' : 'false'"
              />
              <span class="text-xs text-muted-foreground">
                {{ input.value === 'true' ? $t('common.on') : $t('common.off') }}
              </span>
            </div>
            <!-- Unknown/empty type: text input fallback -->
            <Input
              v-else
              v-model="input.value"
              data-param-input
              type="text"
              class="h-8 text-sm"
              @keydown="onKeydown"
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('cancel')">
          {{ $t('common.cancel') }}
        </Button>
        <Button @click="onSubmit">
          {{ $t('execution.btnRun') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
