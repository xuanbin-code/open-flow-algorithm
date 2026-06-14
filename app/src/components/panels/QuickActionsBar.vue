<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Save, FolderOpen, Undo2, Redo2 } from '../icons'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'

const { t } = useI18n()

defineProps<{
  canSave: boolean
  canUndo: boolean
  canRedo: boolean
  isExecuting: boolean
}>()

defineEmits<{
  save: []
  open: []
  undo: []
  redo: []
}>()
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div class="quick-actions-bar">
      <!-- Save -->
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            class="qa-btn"
            :disabled="!canSave || isExecuting"
            @click="$emit('save')"
          >
            <Save :size="16" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{{ $t('quickActions.save') }}</p>
        </TooltipContent>
      </Tooltip>

      <!-- Open -->
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            class="qa-btn"
            :disabled="isExecuting"
            @click="$emit('open')"
          >
            <FolderOpen :size="16" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{{ $t('quickActions.open') }}</p>
        </TooltipContent>
      </Tooltip>

      <!-- Separator -->
      <Separator orientation="vertical" class="h-4 bg-border" />

      <!-- Undo -->
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            class="qa-btn"
            :disabled="!canUndo"
            @click="$emit('undo')"
          >
            <Undo2 :size="16" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{{ $t('quickActions.undo') }}</p>
        </TooltipContent>
      </Tooltip>

      <!-- Redo -->
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            class="qa-btn"
            :disabled="!canRedo"
            @click="$emit('redo')"
          >
            <Redo2 :size="16" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{{ $t('quickActions.redo') }}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</template>

<style scoped>
.quick-actions-bar {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  background: var(--bg-float-panel-95);
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  box-shadow: var(--shadow-debug);
  backdrop-filter: blur(8px);
}

.qa-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  border: none;
}

.qa-btn:hover:not(:disabled) {
  background: var(--bg-hover-strong);
  color: var(--text-primary);
}

.qa-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
