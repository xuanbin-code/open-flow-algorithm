<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CodeEditor } from '@/components/ui/code-editor'
import { python } from '@codemirror/lang-python'
import { File, Clipboard, FolderOpen, LayoutTemplate } from '@/lib/icons'
import { showOpenDialog, isPythonBackendAvailable } from '@/platform'
import { PRESET_TEMPLATES, type PresetTemplate } from '@/engine/presets'

const { t: _t } = useI18n()

// ── Props / Emits ──

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  create: [payload: { type: 'blank' } | { type: 'paste'; code: string } | { type: 'open'; filePath: string } | { type: 'preset'; xml: string }]
}>()

// ── State ──

type OptionId = 'blank' | 'paste' | 'open' | 'preset'

const selectedOption = ref<OptionId>('blank')
const pastedCode = ref('')
const selectedFilePath = ref('')
const selectedPresetId = ref<string | null>(null)
const isLoading = ref(false)

const pythonLanguage = python()

const pythonAvailable = computed(() => isPythonBackendAvailable())

// ── Options ──

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
  {
    id: 'preset',
    titleKey: 'newFileDialog.presetTitle',
    descKey: 'newFileDialog.presetDesc',
    icon: LayoutTemplate,
    disabled: false,
  },
])

// ── Create validation ──

const canCreate = computed(() => {
  if (isLoading.value) return false
  switch (selectedOption.value) {
    case 'blank':
      return true
    case 'paste':
      return pastedCode.value.trim().length > 0
    case 'open':
      return selectedFilePath.value.length > 0
    case 'preset':
      return selectedPresetId.value !== null
    default:
      return false
  }
})

// ── Grouped presets ──

const categoryOrder = ['math', 'loops', 'arrays'] as const

const presetsByCategory = computed(() => {
  const map = new Map<string, PresetTemplate[]>()
  for (const p of PRESET_TEMPLATES) {
    const list = map.get(p.category) ?? []
    list.push(p)
    map.set(p.category, list)
  }
  return categoryOrder
    .filter(cat => map.has(cat))
    .map(cat => ({ category: cat, presets: map.get(cat)! }))
})

// ── Watchers ──

// Reset state when dialog opens
watch(() => props.visible, (val) => {
  if (val) {
    selectedOption.value = 'blank'
    pastedCode.value = ''
    selectedFilePath.value = ''
    selectedPresetId.value = null
    isLoading.value = false
  }
})

// ── Methods ──

function selectOption(id: OptionId) {
  const opt = options.value.find(o => o.id === id)
  if (!opt || opt.disabled) return
  selectedOption.value = id
}

function selectPreset(id: string) {
  selectedPresetId.value = id
}

const selectedPresetXml = computed(() => {
  if (!selectedPresetId.value) return ''
  return PRESET_TEMPLATES.find(p => p.id === selectedPresetId.value)?.xml ?? ''
})

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
      case 'preset': {
        const xml = selectedPresetXml.value
        if (!xml) return
        emit('create', { type: 'preset', xml })
        break
      }
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
    <DialogContent class="max-w-4xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <File class="h-5 w-5 text-accent" />
          <span>{{ $t('newFileDialog.title') }}</span>
        </DialogTitle>
        <DialogDescription>
          {{ $t('newFileDialog.description') }}
        </DialogDescription>
      </DialogHeader>

      <!-- Side-by-side body wrapper -->
      <div class="new-file-body">

        <!-- LEFT: 2×2 Option Grid -->
        <div class="option-grid-panel">
          <div class="option-grid">
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
          <div class="option-card-body">
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
        </div>

        <!-- RIGHT: Conditional content panel -->
        <div v-if="selectedOption !== 'blank'" class="content-panel">

          <!-- Paste: Python Code Editor -->
          <div v-if="selectedOption === 'paste' && pythonAvailable" class="paste-area">
        <CodeEditor
          v-model:model-value="pastedCode"
          :single-line="false"
          :language="pythonLanguage"
          :placeholder="$t('newFileDialog.pastePlaceholder')"
          class="paste-editor"
        />
      </div>

      <!-- Open: Browse button -->
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

      <!-- Preset: Categorized template grid -->
      <div v-if="selectedOption === 'preset'" class="preset-section">
        <div
          v-for="group in presetsByCategory"
          :key="group.category"
          class="preset-category"
        >
          <div class="preset-category-header">
            {{ $t(`newFileDialog.presetCategories.${group.category}`) }}
          </div>
          <div class="preset-grid">
            <button
              v-for="preset in group.presets"
              :key="preset.id"
              type="button"
              class="preset-card"
              :class="{ selected: selectedPresetId === preset.id }"
              @click="selectPreset(preset.id)"
            >
              <div class="preset-card-icon">
                <LayoutTemplate class="h-3.5 w-3.5" />
              </div>
              <div class="preset-card-text">
                <div class="preset-card-title">{{ $t(preset.nameKey) }}</div>
                <div class="preset-card-desc">{{ $t(preset.descKey) }}</div>
              </div>
            </button>
          </div>
        </div>

        </div>
        </div>
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
/* ── Side-by-side body container ── */
.new-file-body {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 24px;
}

/* ── Left panel (2×2 grid wrapper) ── */
.option-grid-panel {
  flex: 1;
  min-width: 0;
}

/* ── Right panel (conditional content wrapper) ── */
.content-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* ── 2×2 Option Grid ── */
.option-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.option-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 22px 16px 20px;
  border: 2px solid var(--border-soft);
  border-radius: 12px;
  background: var(--bg-panel);
  cursor: pointer;
  text-align: center;
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
  width: 46px;
  height: 46px;
  border-radius: 10px;
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

.option-card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.option-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.option-card-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
  max-width: 200px;
}

/* ── Paste Area (CodeEditor) ── */
.paste-editor {
  min-height: 320px;
  max-height: 600px;
}

.paste-editor :deep(.code-editor-host) {
  height: 320px;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  overflow: hidden;
}

.paste-editor :deep(.cm-editor) {
  height: 100%;
}

.paste-editor :deep(.cm-scroller) {
  overflow-y: auto !important;
}

/* ── Open Area ── */
.open-area {
  display: flex;
  align-items: center;
  gap: 12px;
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

/* ── Preset Section ── */
.preset-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 55vh;
  min-height: 300px;
  overflow-y: auto;
  padding-right: 6px;
  flex: 1;
}

/* Category header */
.preset-category {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preset-category-header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  padding: 0 2px;
}

/* Preset grid within each category */
.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 8px;
}

/* Preset card */
.preset-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1.5px solid var(--border-soft);
  border-radius: 8px;
  background: var(--bg-panel);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.preset-card:hover {
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  background: color-mix(in srgb, var(--accent) 4%, var(--bg-panel));
}

.preset-card.selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-panel));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 15%, transparent);
}

.preset-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  flex-shrink: 0;
}

.preset-card.selected .preset-card-icon {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
}

.preset-card-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.preset-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.preset-card-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Preset Section Scrollbar ── */
.preset-section::-webkit-scrollbar {
  width: 4px;
}

.preset-section::-webkit-scrollbar-track {
  background: transparent;
}

.preset-section::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 2px;
}

.preset-section::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--scrollbar-thumb) 80%, var(--text-muted));
}

/* Firefox */
.preset-section {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}
</style>
