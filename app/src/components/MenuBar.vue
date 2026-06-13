<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettings } from '../composables/useSettings'
import { Sun, Moon, Settings, Play, StepForward, Pause, Square, Table } from './icons'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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
  MenubarTrigger,
} from '@/components/ui/menubar'

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
  executionStatus?: 'idle' | 'running' | 'paused' | 'waiting-input' | 'stopped'
  executionSpeed?: 'slow' | 'normal' | 'fast'
  showVariableMonitor?: boolean
}>()

const emit = defineEmits<{
  action: [menuId: string]
  run: []
  step: []
  pause: []
  resume: []
  stop: []
  setSpeed: [speed: 'slow' | 'normal' | 'fast']
  toggleVariableMonitor: []
}>()

// ============================================================
// Menu data
// ============================================================

const menuFileItems = computed<MenuItem[]>(() => {
  const base: MenuItem[] = [
    { id: 'new', label: t('menu.new') },
    { id: 'open', label: t('menu.open') },
    { id: 'save', label: t('menu.save') },
    { id: 'saveAs', label: t('menu.saveAs') },
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
        { id: 'delete', label: t('common.delete'), disabled: true },
        { id: 'undo', label: t('menu.undo') },
        { id: 'redo', label: t('menu.redo') },
      ],
    },
    {
      id: 'program',
      label: t('menu.program'),
      items: [
        { id: 'run', label: t('menu.run'), disabled: es === 'running' || es === 'waiting-input' },
        { id: 'step', label: t('menu.step'), disabled: es === 'running' || es === 'waiting-input' },
        { id: 'stop', label: t('menu.stop'), disabled: es === 'idle' || es === 'stopped' },
        { id: 'div-speed', label: '', divider: true },
        { id: 'speed-slow', label: t('menu.speedSlow') },
        { id: 'speed-normal', label: t('menu.speedNormal') },
        { id: 'speed-fast', label: t('menu.speedFast') },
      ],
    },
  ]
})

// ============================================================
// Execution controls
// ============================================================

type ExecStatus = 'idle' | 'running' | 'paused' | 'waiting-input' | 'stopped'

const es = computed<ExecStatus>(() => props.executionStatus ?? 'idle')

const canRun = computed(() => es.value === 'idle' || es.value === 'stopped')
const canStep = computed(() => es.value === 'idle' || es.value === 'stopped' || es.value === 'paused')
const canPause = computed(() => es.value === 'running')
const canStop = computed(() => es.value === 'running' || es.value === 'paused' || es.value === 'waiting-input')
const isPaused = computed(() => es.value === 'paused')

const stepLabel = computed(() => isPaused.value ? t('execution.btnContinue') : t('execution.btnStep'))

function onPauseClick() {
  if (isPaused.value) {
    emit('resume')
  } else {
    emit('pause')
  }
}

// ============================================================
// Theme toggle
// ============================================================

const { settings } = useSettings()

function toggleTheme() {
  settings.value.theme = settings.value.theme === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <div class="menu-bar">
    <!-- Menus -->
    <Menubar class="border-0 bg-transparent p-0">
      <MenubarMenu v-for="menu in menus" :key="menu.id">
        <MenubarTrigger class="text-xs h-7">
          {{ menu.label }}
        </MenubarTrigger>
        <MenubarContent>
          <template v-for="item in menu.items" :key="item.id">
            <!-- Sublabel -->
            <div
              v-if="item.sublabel && item.disabled"
              class="px-2 py-1 text-[11px] text-muted-foreground"
            >
              {{ item.sublabel }}
            </div>
            <!-- Divider -->
            <MenubarSeparator v-else-if="item.divider" />
            <!-- Normal item -->
            <MenubarItem
              v-else
              :disabled="item.disabled"
              @click="emit('action', item.id)"
            >
              {{ item.label }}
            </MenubarItem>
          </template>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>

    <Separator orientation="vertical" class="mx-1 h-4" />

    <!-- Execution toolbar -->
    <div class="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="xs"
        :disabled="!canRun"
        :title="$t('execution.btnRun')"
        @click="emit('run')"
      >
        <Play :size="14" />
        <span>{{ $t('execution.btnRun') }}</span>
      </Button>
      <Button
        variant="ghost"
        size="xs"
        :disabled="!canStep"
        :title="stepLabel"
        @click="emit('step')"
      >
        <StepForward :size="14" />
        <span>{{ stepLabel }}</span>
      </Button>
      <Button
        variant="ghost"
        size="xs"
        :disabled="!canPause && !isPaused"
        :title="isPaused ? $t('execution.btnResume') : $t('execution.btnPause')"
        @click="onPauseClick"
      >
        <Pause v-if="!isPaused" :size="14" />
        <Play v-else :size="14" />
        <span>{{ isPaused ? $t('execution.btnResume') : $t('execution.btnPause') }}</span>
      </Button>
      <Button
        variant="ghost"
        size="xs"
        :disabled="!canStop"
        :title="$t('execution.btnStop')"
        @click="emit('stop')"
      >
        <Square :size="14" />
        <span>{{ $t('execution.btnStop') }}</span>
      </Button>

      <Separator orientation="vertical" class="mx-1 h-4" />

      <!-- Speed -->
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

      <Separator orientation="vertical" class="mx-1 h-4" />

      <!-- Variable monitor toggle -->
      <Button
        variant="ghost"
        size="xs"
        :class="{ 'text-accent': showVariableMonitor }"
        :title="showVariableMonitor ? $t('execution.hideVarMonitor') : $t('execution.showVarMonitor')"
        @click="emit('toggleVariableMonitor')"
      >
        <Table :size="14" />
        <span v-if="showVariableMonitor">{{ $t('execution.hideVarMonitor') }}</span>
      </Button>
    </div>

    <!-- Right-aligned buttons -->
    <div class="ml-auto flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        :title="settings.theme === 'dark' ? $t('menu.switchToLight') : $t('menu.switchToDark')"
        @click="toggleTheme"
      >
        <Sun v-if="settings.theme === 'dark'" :size="16" />
        <Moon v-else :size="16" />
      </Button>
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
  height: 32px;
  padding: 0 6px;
  background: var(--bg-menu);
  border-bottom: 1px solid var(--border-color);
  user-select: none;
  flex-shrink: 0;
}
</style>
