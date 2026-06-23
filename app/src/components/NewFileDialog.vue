<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { File, Clipboard, FolderOpen } from '@/lib/icons'
import { showOpenDialog, isPythonBackendAvailable } from '@/platform'

const { t: _t } = useI18n()

// ── Props / Emits ──

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  create: [payload: { type: 'blank' } | { type: 'paste'; code: string } | { type: 'open'; filePath: string }]
}>()

// ── State ──

type OptionId = 'blank' | 'paste' | 'open'

const selectedOption = ref<OptionId>('blank')
const pastedCode = ref('')
const selectedFilePath = ref('')
const isLoading = ref(false)

const pythonAvailable = computed(() => isPythonBackendAvailable())

interface CardOption {
  id: OptionId
  titleKey: string
  descKey: string
  icon: typeof File
  disabled: boolean
}

const options = computed<CardOption[]>(() => [
  {
    id: 'blank',
    titleKey: 'newFileDialog.blankTitle',
    descKey: 'newFileDialog.blankDesc',
    icon: File,
    disabled: false,
  },
  {
    id: 'paste',
    titleKey: 'newFileDialog.pasteTitle',
    descKey: 'newFileDialog.pasteDesc',
    icon: Clipboard,
    disabled: !pythonAvailable.value,
  },
  {
    id: 'open',
    titleKey: 'newFileDialog.openTitle',
    descKey: 'newFileDialog.openDesc',
    icon: FolderOpen,
    disabled: !pythonAvailable.value,
  },
])

const canCreate = computed(() => {
  if (isLoading.value) return false
  switch (selectedOption.value) {
    case 'blank':
      return true
    case 'paste':
      return pastedCode.value.trim().length > 0
    case 'open':
      return selectedFilePath.value.length > 0
    default:
      return false
  }
})

// ── Watchers ──

// Reset state when dialog opens
watch(() => props.visible, (val) => {
  if (val) {
    selectedOption.value = 'blank'
    pastedCode.value = ''
    selectedFilePath.value = ''
    isLoading.value = false
  }
})

// ── Methods ──

function selectOption(id: OptionId) {
  const opt = options.value.find(o => o.id === id)
  if (!opt || opt.disabled) return
  selectedOption.value = id
}

async function handleBrowse() {
  try {
    const result = await showOpenDialog([
      { name: 'Python File', extensions: ['py'] },
    ])
    if (result) {
      selectedFilePath.value = result.filePath
    }
  } catch (e: unknown) {
    console.error('[NewFileDialog] Browse failed:', e)
  }
}

async function handleCreate() {
  if (!canCreate.value) return

  isLoading.value = true

  try {
    switch (selectedOption.value) {
      case 'blank':
        emit('create', { type: 'blank' })
        break
      case 'paste':
        emit('create', { type: 'paste', code: pastedCode.value })
        break
      case 'open':
        emit('create', { type: 'open', filePath: selectedFilePath.value })
        break
    }
  } finally {
    isLoading.value = false
  }
}

function onOpenChange(open: boolean) {
  if (!open) emit('close')
}
</script>

<template>
  <Dialog :open="props.visible" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <File class="h-5 w-5 text-accent" />
          <span>{{ $t('newFileDialog.title') }}</span>
        </DialogTitle>
        <DialogDescription>
          {{ $t('newFileDialog.description') }}
        </DialogDescription>
      </DialogHeader>

      <!-- Option cards -->
      <div class="option-cards">
        <button
          v-for="opt in options"
          :key="opt.id"
          type="button"
          class="option-card"
          :class="{
            selected: selectedOption === opt.id,
            disabled: opt.disabled,
          }"
          :disabled="opt.disabled"
          @click="selectOption(opt.id)"
        >
          <div class="option-card-icon">
            <component :is="opt.icon" class="h-6 w-6" />
          </div>
          <div class="option-card-text">
            <div class="option-card-title">{{ $t(opt.titleKey) }}</div>
            <div class="option-card-desc">
              <template v-if="opt.disabled">
                {{ $t('newFileDialog.pythonNotAvailable') }}
              </template>
              <template v-else>
                {{ $t(opt.descKey) }}
              </template>
            </div>
          </div>
        </button>
      </div>

      <!-- Conditional input area -->
      <div v-if="selectedOption === 'paste' && pythonAvailable" class="paste-area">
        <Textarea
          v-model="pastedCode"
          :placeholder="$t('newFileDialog.pastePlaceholder')"
          class="paste-textarea"
        />
      </div>

      <div v-if="selectedOption === 'open' && pythonAvailable" class="open-area">
        <Button variant="outline" @click="handleBrowse">
          <FolderOpen class="h-4 w-4 mr-1" />
          {{ $t('newFileDialog.browseButton') }}
        </Button>
        <span v-if="selectedFilePath" class="selected-path">
          {{ selectedFilePath }}
        </span>
        <span v-else class="no-file-text">
          {{ $t('newFileDialog.noFileSelected') }}
        </span>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('close')">
          {{ $t('common.cancel') }}
        </Button>
        <Button :disabled="!canCreate" @click="handleCreate">
          {{ isLoading ? $t('newFileDialog.parsing') : $t('newFileDialog.createButton') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
/* ── Option Cards ── */
.option-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 4px;
}

.option-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 16px;
  border: 2px solid var(--border-soft);
  border-radius: 10px;
  background: var(--bg-panel);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.option-card:hover:not(.disabled) {
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  background: color-mix(in srgb, var(--accent) 4%, var(--bg-panel));
}

.option-card.selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-panel));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
}

.option-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  flex-shrink: 0;
}

.option-card.selected .option-card-icon {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
}

.option-card.disabled .option-card-icon {
  background: color-mix(in srgb, var(--text-muted) 10%, transparent);
  color: var(--text-muted);
}

.option-card-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.option-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.option-card-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

/* ── Paste Area ── */
.paste-area {
  margin-top: 4px;
}

.paste-textarea {
  min-height: 160px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
}

/* ── Open Area ── */
.open-area {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
  padding: 8px 0;
}

.selected-path {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-file-text {
  font-size: 13px;
  color: var(--text-muted);
}
</style>
