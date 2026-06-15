<script setup lang="ts">
import { Pencil, Trash2 } from '@/lib/icons'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  nodeId: string
  canDelete: boolean
  canEdit: boolean
}>()

const emit = defineEmits<{
  edit: [nodeId: string]
  delete: [nodeId: string]
}>()
</script>

<template>
  <ContextMenuContent class="w-36">
    <ContextMenuItem
      :disabled="!props.canEdit"
      @select="emit('edit', props.nodeId)"
    >
      <Pencil :size="14" class="mr-2" />
      {{ t('menu.edit') }}
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem
      class="text-destructive focus:bg-destructive/10 focus:text-destructive"
      :disabled="!props.canDelete"
      @select="emit('delete', props.nodeId)"
    >
      <Trash2 :size="14" class="mr-2" />
      {{ t('common.delete') }}
    </ContextMenuItem>
  </ContextMenuContent>
</template>
