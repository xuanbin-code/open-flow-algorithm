<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Keyboard } from '@/lib/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  visible: boolean
  variableName: string
}>()

const emit = defineEmits<{
  submit: [value: string]
  cancel: []
}>()

// ============================================================
// State
// ============================================================

const inputValue = ref('')

// Bridge visible prop to dialog open state
function onOpenChange(open: boolean) {
  if (!open) {
    emit('cancel')
  }
}

// Auto-focus input when dialog opens
watch(
  () => props.visible,
  async (v) => {
    if (v) {
      inputValue.value = ''
      await nextTick()
      // Focus the actual input element inside the Input component
      const el = document.querySelector<HTMLInputElement>('[data-input-dialog]')
      el?.focus()
    }
  },
)

// ============================================================
// Keyboard handling
// ============================================================

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    onSubmit()
  }
}

function onSubmit() {
  emit('submit', inputValue.value)
}
</script>

<template>
  <Dialog :open="visible" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Keyboard :size="18" />
          <span>{{ $t('nodes.kind.input') }}</span>
        </DialogTitle>
        <DialogDescription>
          {{ $t('execution.inputPlaceholder', { name: variableName }) }}
        </DialogDescription>
      </DialogHeader>

      <div class="py-2">
        <Input
          v-model="inputValue"
          data-input-dialog
          :placeholder="$t('execution.waitingForRun')"
          @keydown="onKeydown"
        />
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('cancel')">
          {{ $t('common.cancel') }}
        </Button>
        <Button @click="onSubmit">
          {{ $t('common.ok') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
