<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Settings, Play, StepForward, Pause, Square } from '@/lib/icons'
import { Button } from '@/components/ui/button'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from '@/components/ui/menubar'
import { useShortcutStore } from '../stores/shortcuts'
import { comboToString } from '../types/shortcuts'
import type { ShortcutActionId } from '../types/shortcuts'

const { t } = useI18n()

// ============================================================
// Types
// ============================================================

interface MenuItem {
  id: string
  label: string
  disabled?: boolean
  divider?: boolean
  sublabel?: string
  submenu?: MenuItem[]
  shortcutAction?: ShortcutActionId
}

interface TopMenu {
  id: string
  label: string
  items: MenuItem[]
}

interface RecentEntry {
  path: string
  name: string
  openedAt: string
}

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  selectedNodeId?: string | null
  recentFiles?: RecentEntry[]
  currentFilePath?: string | null
  isNewFile?: boolean
  isDirty?: boolean
  executionStatus?: 'idle' | 'running' | 'paused' | 'waiting-input' | 'stopped'
  executionSpeed?: 'slow' | 'normal' | 'fast'
}>()

const emit = defineEmits<{
  action: [menuId: string]
  run: []
  step: []
  pause: []
  resume: []
  stop: []
  setSpeed: [speed: 'slow' | 'normal' | 'fast']
}>()

// ============================================================
// Menu data
// ============================================================

const menuFileItems = computed<MenuItem[]>(() => {
  const base: MenuItem[] = [
    { id: 'new', label: t('menu.new'), shortcutAction: 'new' },
    { id: 'open', label: t('menu.open'), shortcutAction: 'open' },
    { id: 'save', label: t('menu.save'), shortcutAction: 'save' },
    { id: 'saveAs', label: t('menu.saveAs') },
    { id: 'import-python', label: t('menu.importPython') },
  ]

  const recents = props.recentFiles ?? []
  if (recents.length > 0) {
    base.push({ id: 'div-recent', label: '', divider: true })
    base.push({ id: 'recent-label', label: t('menu.recentFiles'), disabled: true, sublabel: t('menu.recentFiles') })
    for (const entry of recents) {
      base.push({ id: `open-recent:${entry.path}`, label: entry.name })
    }
  }

  base.push({ id: 'div-close', label: '', divider: true })
  base.push({ id: 'exit', label: t('menu.exit') })
  return base
})

const menus = computed<TopMenu[]>(() => {
  const es = props.executionStatus ?? 'idle'

  return [
    {
      id: 'file',
      label: t('menu.file'),
      items: menuFileItems.value,
    },
    {
      id: 'edit',
      label: t('menu.edit'),
      items: [
        { id: 'delete', label: t('common.delete'), disabled: true, shortcutAction: 'deleteSelected' },
        { id: 'undo', label: t('menu.undo'), shortcutAction: 'undo' },
        { id: 'redo', label: t('menu.redo'), shortcutAction: 'redo' },
      ],
    },
    {
      id: 'program',
      label: t('menu.program'),
      items: [
        { id: 'run', label: t('menu.run'), disabled: es === 'running' || es === 'waiting-input', shortcutAction: 'run' },
        { id: 'step', label: t('menu.step'), disabled: es === 'running' || es === 'waiting-input', shortcutAction: 'step' },
        { id: 'stop', label: t('menu.stop'), disabled: es === 'idle' || es === 'stopped', shortcutAction: 'stop' },
        { id: 'div-speed', label: '', divider: true },
        { id: 'speed-slow', label: t('menu.speedSlow') },
        { id: 'speed-normal', label: t('menu.speedNormal') },
        { id: 'speed-fast', label: t('menu.speedFast') },
        { id: 'div-export', label: '', divider: true },
        { id: 'export-python', label: t('menu.exportPython') },
      ],
    },
  ]
})

// ============================================================
// Execution controls
// ============================================================

type ExecStatus = 'idle' | 'running' | 'paused' | 'waiting-input' | 'stopped'

const es = computed<ExecStatus>(() => props.executionStatus ?? 'idle')

const canStep = computed(() => es.value === 'idle' || es.value === 'stopped' || es.value === 'paused')
const canStop = computed(() => es.value === 'running' || es.value === 'paused' || es.value === 'waiting-input')

const stepLabel = computed(() => es.value === 'paused' ? t('execution.btnContinue') : t('execution.btnStep'))

/** 运行/暂停 按钮 */
const runBtnLabel = computed(() => {
  if (es.value === 'running') return t('execution.btnPause')
  return t('execution.btnRun')
})

const runBtnDisabled = computed(() => es.value === 'waiting-input' || es.value === 'paused')

function onRunBtnClick() {
  if (es.value === 'running') {
    emit('pause')
  } else {
    emit('run')
  }
}

const fileName = computed(() => {
  if (!props.currentFilePath) return t('common.untitledFile')
  const parts = props.currentFilePath.split(/[\\/]/)
  const base = parts[parts.length - 1] || t('common.untitledFile')
  return props.isDirty ? `* ${base}` : base
})

// ============================================================
// Shortcut store
// ============================================================

const shortcutStore = useShortcutStore()
</script>

<template>
  <div class="menu-bar">
    <div class="brand-zone">
      <div class="app-mark">OF</div>
      <div class="file-stack">
        <div class="app-name">Open Flow Algorithm</div>
        <div class="file-line">
          <span class="file-name">{{ fileName }}</span>
          <span v-if="isNewFile" class="file-state">{{ $t('common.draft') }}</span>
        </div>
      </div>
    </div>

    <div class="menu-zone">
      <Menubar class="border-0 bg-transparent p-0">
        <MenubarMenu v-for="menu in menus" :key="menu.id">
          <MenubarTrigger class="h-8 text-xs">
            {{ menu.label }}
          </MenubarTrigger>
          <MenubarContent>
            <template v-for="item in menu.items" :key="item.id">
              <div
                v-if="item.sublabel && item.disabled"
                class="px-2 py-1 text-[11px] text-muted-foreground"
              >
                {{ item.sublabel }}
              </div>
              <MenubarSeparator v-else-if="item.divider" />
              <MenubarItem
                v-else
                :disabled="item.disabled"
                @click="emit('action', item.id)"
              >
                {{ item.label }}
                <MenubarShortcut v-if="item.shortcutAction">
                  {{ comboToString(shortcutStore.shortcuts[item.shortcutAction]) }}
                </MenubarShortcut>
              </MenubarItem>
            </template>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>

    <div class="run-zone">
      <!-- Run / Pause / Resume（三态切换） -->
      <Button
        variant="ghost"
        size="sm"
        :disabled="runBtnDisabled"
        :title="runBtnLabel"
        @click="onRunBtnClick"
      >
        <Pause v-if="es === 'running' || es === 'waiting-input'" :size="14" />
        <Play v-else :size="14" />
        <span>{{ runBtnLabel }}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :disabled="!canStep"
        :title="stepLabel"
        @click="emit('step')"
      >
        <StepForward :size="14" />
        <span>{{ stepLabel }}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :disabled="!canStop"
        :title="$t('execution.btnStop')"
        @click="emit('stop')"
      >
        <Square :size="14" />
        <span>{{ $t('execution.btnStop') }}</span>
      </Button>
    </div>

    <div class="tool-zone">
      <ToggleGroup
        type="single"
        size="sm"
        :model-value="executionSpeed ?? 'normal'"
        @update:model-value="(v) => v && emit('setSpeed', v as 'slow' | 'normal' | 'fast')"
      >
        <ToggleGroupItem value="slow" class="text-[10px] px-2">
          {{ $t('execution.speedSlow') }}
        </ToggleGroupItem>
        <ToggleGroupItem value="normal" class="text-[10px] px-2">
          {{ $t('execution.speedNormal') }}
        </ToggleGroupItem>
        <ToggleGroupItem value="fast" class="text-[10px] px-2">
          {{ $t('execution.speedFast') }}
        </ToggleGroupItem>
      </ToggleGroup>

    </div>

    <div class="right-zone">
      <Button
        variant="ghost"
        size="icon-sm"
        :title="$t('common.settings')"
        @click="emit('action', 'open-settings')"
      >
        <Settings :size="16" />
      </Button>
    </div>
  </div>
</template>

<style scoped>
.menu-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 58px;
  padding: 8px 10px;
  background: var(--bg-menu);
  border-bottom: 1px solid var(--border-soft);
  user-select: none;
  flex-shrink: 0;
}

.brand-zone,
.run-zone,
.tool-zone,
.right-zone,
.menu-zone {
  display: flex;
  align-items: center;
}

.brand-zone {
  min-width: 248px;
  gap: 10px;
}

.app-mark {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 8px;
  background: var(--accent);
  color: var(--accent-foreground);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  box-shadow: 0 8px 22px color-mix(in srgb, var(--accent) 28%, transparent);
}

.file-stack {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.app-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
}

.file-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--text-muted);
  font-size: 11px;
}

.file-name {
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-state {
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.menu-zone {
  padding-right: 2px;
}

.run-zone {
  gap: 4px;
  margin-left: auto;
  padding: 3px;
  border: 1px solid var(--border-soft);
  border-radius: 9px;
  background: var(--bg-toolbar);
}

.run-primary {
  background: var(--accent) !important;
  color: var(--accent-foreground) !important;
  box-shadow: 0 6px 18px color-mix(in srgb, var(--accent) 22%, transparent);
}

.run-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 82%, black) !important;
  box-shadow: 0 6px 22px color-mix(in srgb, var(--accent) 35%, transparent) !important;
}

.tool-zone {
  gap: 8px;
}

.is-active {
  color: var(--accent) !important;
  background: color-mix(in srgb, var(--accent) 10%, transparent) !important;
}

.right-zone {
  gap: 4px;
}

/* ===================================================================
   Menubar trigger — scoped :deep() 穿透到 Reka UI 的 <button>
   =================================================================== */

/* 默认状态：可见文字 + 透明背景 */
.menu-bar :deep([role="menuitem"]) {
  color: var(--text-primary);
  background: transparent;
}

/* 悬停/焦点/打开状态：强调色背景 */
.menu-bar :deep([role="menuitem"]:hover),
.menu-bar :deep([role="menuitem"]:focus-visible),
.menu-bar :deep([role="menuitem"][data-state="open"]) {
  background: var(--accent);
  color: var(--accent-foreground);
}
</style>
