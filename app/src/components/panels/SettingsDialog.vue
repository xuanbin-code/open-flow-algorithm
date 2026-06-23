<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import type { ThemeMode } from '../../stores/settings'
import { useShortcutStore } from '../../stores/shortcuts'
import { ACCENT_PRESETS } from '../../lib/colorPalette'
import { Sun, Moon, Monitor, Settings, Keyboard, Check, Undo2 } from '@/lib/icons'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ShortcutActionId } from '../../types/shortcuts'
import { comboToString } from '../../types/shortcuts'
import { useShortcutCapture } from '../../composables/useShortcutCapture'

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// ============================================================
// Stores
// ============================================================

const settingsStore = useSettingsStore()
const shortcutStore = useShortcutStore()

// ============================================================
// Sidebar navigation
// ============================================================

type PanelId = 'general' | 'appearance' | 'shortcuts'
const activePanel = ref<PanelId>('general')

interface NavItem {
  id: PanelId
  icon: typeof Settings   // any Lucide component type
  labelKey: string        // i18n key under settings.sidebar
}

const navItems: NavItem[] = [
  { id: 'general',    icon: Settings, labelKey: 'settings.sidebar.general' },
  { id: 'appearance', icon: Sun,      labelKey: 'settings.sidebar.appearance' },
  { id: 'shortcuts',  icon: Keyboard, labelKey: 'settings.sidebar.shortcuts' },
]

// 设置窗口打开/关闭时暂停/恢复全局快捷键
watch(() => props.visible, (val) => {
  shortcutStore.shortcutsPaused = val
})

// ============================================================
// Accent color state (from original)
// ============================================================

const activePresetId = computed(() => {
  const val = settingsStore.accentColor
  if (val.startsWith('#')) return null
  return val
})

const customColorHex = computed({
  get: () => {
    const val = settingsStore.accentColor
    return val.startsWith('#') ? val : '#4fc3f7'
  },
  set: (hex: string) => {
    settingsStore.accentColor = hex
  },
})

function selectPreset(presetId: string) {
  settingsStore.accentColor = presetId
}

function onCustomColorChange(e: Event) {
  const input = e.target as HTMLInputElement
  settingsStore.accentColor = input.value
}

// ============================================================
// Theme options
// ============================================================

interface ThemeOption {
  value: ThemeMode
  icon: typeof Sun  // any Lucide component type
  labelKey: string   // i18n key under settings
}

const themeOptions: ThemeOption[] = [
  { value: 'dark',   icon: Moon,    labelKey: 'settings.dark' },
  { value: 'light',  icon: Sun,     labelKey: 'settings.light' },
  { value: 'system', icon: Monitor, labelKey: 'settings.system' },
]

// ============================================================
// Language (bidirectional binding)
// ============================================================

const languageValue = computed({
  get: () => settingsStore.language,
  set: (val: string) => { settingsStore.language = val },
})

// ============================================================
// Shortcuts panel
// ============================================================

const capture = useShortcutCapture()

// 生命周期：录制期间注册 capture-phase keydown 监听器
onMounted(() => {
  window.addEventListener('keydown', onCaptureKeydownWrapper, true)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onCaptureKeydownWrapper, true)
})

function onCaptureKeydownWrapper(e: KeyboardEvent) {
  capture.onCaptureKeydown(e)
}

/** 确认捕获 → 更新 store */
function onConfirmCapture() {
  const actionId = capture.capturingActionId.value
  const combo = capture.confirmCapture()
  if (combo && actionId) {
    shortcutStore.updateShortcut(actionId, combo)
  }
}

/** 模板 helper：是否正在为指定 action 录制 */
function isRecordingFor(actionId: ShortcutActionId): boolean {
  return capture.isRecording.value && capture.capturingActionId.value === actionId
}

/** 模板 helper：获取已捕获 combo 的可读字符串 */
function capturedComboString(): string {
  return capture.capturedCombo.value ? comboToString(capture.capturedCombo.value) : ''
}

const SHORTCUT_ACTION_IDS: { id: ShortcutActionId; labelKey: string }[] = [
  { id: 'save',           labelKey: 'shortcuts.actions.save' },
  { id: 'undo',           labelKey: 'shortcuts.actions.undo' },
  { id: 'redo',           labelKey: 'shortcuts.actions.redo' },
  { id: 'deleteSelected', labelKey: 'shortcuts.actions.deleteSelected' },
  { id: 'new',            labelKey: 'shortcuts.actions.new' },
  { id: 'open',           labelKey: 'shortcuts.actions.open' },
  { id: 'run',            labelKey: 'shortcuts.actions.run' },
  { id: 'step',           labelKey: 'shortcuts.actions.step' },
  { id: 'stop',           labelKey: 'shortcuts.actions.stop' },
]
</script>

<template>
  <Dialog :open="props.visible" @update:open="(open) => !open && emit('close')">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Settings :size="20" />
          <span>{{ $t('settings.title') }}</span>
        </DialogTitle>
        <DialogDescription>
          {{ $t('shortcuts.desc') }}
        </DialogDescription>
      </DialogHeader>

      <!-- Sidebar + Content layout -->
      <div class="flex h-[420px] gap-0">
        <!-- Sidebar -->
        <nav class="nav-sidebar w-fit shrink-0 border-r pr-2 pt-1 flex flex-col gap-0.5">
          <button
            v-for="item in navItems"
            :key="item.id"
            class="nav-btn w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left"
            :class="activePanel === item.id
              ? 'bg-accent/15 text-accent font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/5'"
            @click="activePanel = item.id"
          >
            <component :is="item.icon" :size="16" />
            <span>{{ $t(item.labelKey) }}</span>
          </button>
        </nav>

        <!-- Content area -->
        <ScrollArea class="flex-1 pl-4">
          <div class="pr-2">

            <!-- =============================== -->
            <!-- Panel: General                  -->
            <!-- =============================== -->
            <div v-if="activePanel === 'general'" class="flex flex-col gap-6 py-1">
              <!-- Language -->
              <div class="flex items-center justify-between">
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-medium leading-none">{{ $t('settings.languageLabel') }}</span>
                  <span class="text-xs text-muted-foreground">{{ $t('settings.languageDesc') }}</span>
                </div>
                <Select v-model="languageValue">
                  <SelectTrigger class="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh-CN">{{ $t('settings.zhCN') }}</SelectItem>
                    <SelectItem value="en">{{ $t('settings.enUS') }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <!-- Sound effects -->
              <div class="flex items-center justify-between">
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-medium leading-none">{{ $t('settings.soundEffects') }}</span>
                  <span class="text-xs text-muted-foreground">{{ $t('settings.soundEffectsDesc') }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <Checkbox
                    :checked="settingsStore.soundEffects"
                    @update:checked="(v: boolean) => settingsStore.soundEffects = v"
                  />
                  <span class="text-xs text-muted-foreground">
                    {{ settingsStore.soundEffects ? $t('common.on') : $t('common.off') }}
                  </span>
                </div>
              </div>

              <Separator />

              <!-- Default Zoom -->
              <div class="flex items-center justify-between">
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-medium leading-none">{{ $t('settings.defaultZoom') }}</span>
                  <span class="text-xs text-muted-foreground">{{ $t('settings.defaultZoomDesc') }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <input
                    type="range"
                    class="zoom-slider"
                    min="0.1" max="4" step="0.1"
                    :value="settingsStore.defaultZoom"
                    @input="(e: Event) => { settingsStore.defaultZoom = Number((e.target as HTMLInputElement).value) }"
                  />
                  <span class="text-xs font-mono text-muted-foreground w-10 text-right">
                    {{ settingsStore.defaultZoom.toFixed(1) }}x
                  </span>
                </div>
              </div>
            </div>

            <!-- =============================== -->
            <!-- Panel: Appearance               -->
            <!-- =============================== -->
            <div v-if="activePanel === 'appearance'" class="flex flex-col gap-6 py-1">
              <!-- Theme color presets -->
              <div class="flex flex-col gap-2">
                <div>
                  <span class="text-sm font-medium leading-none">{{ $t('settings.themeColor') }}</span>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="preset in ACCENT_PRESETS"
                    :key="preset.id"
                    class="preset-btn flex flex-col items-center gap-1 rounded-lg p-2 transition-colors"
                    :data-active="activePresetId === preset.id ? '' : undefined"
                    :title="preset.name"
                    @click="selectPreset(preset.id)"
                  >
                    <span
                      class="flex size-7 items-center justify-center rounded-full border-2 transition-all"
                      :class="activePresetId === preset.id ? 'border-foreground scale-110' : 'border-transparent'"
                      :style="{ background: settingsStore.resolvedTheme === 'dark' ? preset.dark : preset.light }"
                    >
                      <Check v-if="activePresetId === preset.id" class="size-3.5 text-white drop-shadow" />
                    </span>
                    <span
                      class="text-[10px]"
                      :class="activePresetId === preset.id ? 'text-foreground' : 'text-muted-foreground'"
                    >
                      {{ preset.name }}
                    </span>
                  </button>
                </div>
                <!-- Custom color -->
                <div class="flex items-center gap-3">
                  <span class="text-xs text-muted-foreground">{{ $t('settings.customColor') }}</span>
                  <input
                    type="color"
                    class="size-7 cursor-pointer rounded border border-input bg-transparent p-0.5"
                    :value="customColorHex"
                    @input="onCustomColorChange"
                  />
                  <span class="text-xs font-mono text-muted-foreground">{{ customColorHex }}</span>
                </div>
              </div>

              <Separator />

              <!-- Dark/Light/System toggle -->
              <div class="flex flex-col gap-2">
                <div>
                  <span class="text-sm font-medium leading-none">{{ $t('settings.darkLightMode') }}</span>
                  <span class="text-xs text-muted-foreground ml-1.5">{{ $t('settings.darkLightDesc') }}</span>
                </div>
                <div class="flex items-center rounded-md border border-input bg-secondary p-0.5 w-fit">
                  <button
                    v-for="opt in themeOptions"
                    :key="opt.value"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition-all"
                    :class="settingsStore.theme === opt.value
                      ? 'bg-accent !text-white shadow-sm'
                      : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent/10'"
                    @click="settingsStore.theme = opt.value"
                  >
                    <component :is="opt.icon" :size="14" />
                    <span>{{ $t(opt.labelKey) }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- =============================== -->
            <!-- Panel: Shortcuts                -->
            <!-- =============================== -->
            <div v-if="activePanel === 'shortcuts'" class="flex flex-col gap-3 py-1">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">{{ $t('shortcuts.title') }}</span>
                <Button
                  variant="outline"
                  size="sm"
                  @click="shortcutStore.resetAllShortcuts()"
                >
                  <Undo2 :size="14" class="mr-1" />
                  {{ $t('shortcuts.resetAll') }}
                </Button>
              </div>

              <Separator />

              <div class="flex flex-col gap-1">
                <div
                  v-for="action in SHORTCUT_ACTION_IDS"
                  :key="action.id"
                  class="shortcut-row flex items-center justify-between py-2 px-3 rounded-md transition-colors gap-2"
                  :class="{
                    'bg-accent/10 ring-1 ring-accent/30': isRecordingFor(action.id),
                    'hover:bg-accent/5': !isRecordingFor(action.id),
                  }"
                >
                  <span class="text-sm">{{ $t(action.labelKey) }}</span>
                  <div class="flex items-center gap-2 shrink-0">
                    <!-- Recording state -->
                    <template v-if="isRecordingFor(action.id)">
                      <kbd v-if="capture.capturedCombo.value" class="shortcut-kbd shortcut-kbd-new">
                        {{ capturedComboString() }}
                      </kbd>
                      <span v-else class="text-xs text-accent animate-pulse">
                        {{ $t('shortcuts.recording') }}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        class="h-7 px-2 text-xs"
                        @click="onConfirmCapture"
                      >
                        {{ $t('shortcuts.confirm') }}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 px-2 text-xs"
                        @click="capture.cancelCapture()"
                      >
                        {{ $t('common.cancel') }}
                      </Button>
                    </template>
                    <!-- Normal state -->
                    <template v-else>
                      <kbd class="shortcut-kbd">
                        {{ comboToString(shortcutStore.shortcuts[action.id]) }}
                      </kbd>
                      <Button
                        variant="outline"
                        size="sm"
                        class="h-7 px-2 text-xs"
                        :disabled="capture.isRecording.value"
                        @click="capture.startCapture(action.id)"
                      >
                        {{ $t('shortcuts.change') }}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 px-2 text-xs"
                        :disabled="capture.isRecording.value"
                        @click="shortcutStore.resetShortcut(action.id)"
                      >
                        {{ $t('shortcuts.reset') }}
                      </Button>
                    </template>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </ScrollArea>
      </div>

      <DialogFooter>
        <Button @click="emit('close')">
          {{ $t('common.close') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
/* Nav sidebar — soft divider */
.nav-sidebar {
  border-right-color: var(--border-soft);
}

/* Nav button styling */
.nav-btn {
  border: none;
  background: transparent;
  cursor: pointer;
}

/* Shortcut keycap display */
.shortcut-kbd {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-family: var(--font-mono);
  line-height: 1.4;
  color: var(--text-secondary);
  background: var(--bg-toggle-btn);
  border: 1px solid var(--border);
  border-radius: 4px;
  min-width: 80px;
  justify-content: center;
}

.shortcut-kbd-new {
  color: var(--accent);
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

/* Shortcut row — recording state */
.shortcut-row {
  border: 1px solid transparent;
}

/* ============================================================
   Preset swatch styles (from original)
   ============================================================ */
.preset-btn:hover {
  background-color: color-mix(in srgb, var(--accent) 10%, transparent);
}
.preset-btn[data-active]:hover {
  background-color: color-mix(in srgb, var(--accent) 15%, transparent);
}
.preset-btn[data-active] {
  background-color: color-mix(in srgb, var(--accent) 15%, transparent);
}

:root:not([data-theme="light"]) .preset-btn {
  background-color: var(--bg-toggle-btn);
  border: 1px solid var(--border);
}
:root:not([data-theme="light"]) .preset-btn:hover {
  background-color: var(--bg-toggle-btn-hover);
}
:root:not([data-theme="light"]) .preset-btn[data-active] {
  background-color: color-mix(in srgb, var(--accent) 20%, var(--bg-toggle-btn));
  border-color: var(--accent);
}
:root:not([data-theme="light"]) .preset-btn[data-active]:hover {
  background-color: color-mix(in srgb, var(--accent) 20%, var(--bg-toggle-btn-hover));
  border-color: var(--accent);
}

.zoom-slider {
  width: 100px;
  height: 4px;
  accent-color: var(--accent);
  cursor: pointer;
}
</style>
