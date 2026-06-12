<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettings } from '../composables/useSettings'
import { Sun, Moon, Settings, ChevronRight, Play, StepForward, Pause, Square, Table } from './icons'

const { t } = useI18n()

// ============================================================
// Types
// ============================================================

interface MenuItem {
  id: string
  label: string
  disabled?: boolean
  divider?: boolean
  sublabel?: string   // 灰色小标签 (如 "最近打开的文件")
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
// Menu data (dynamic file menu with recent files)
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
    base.push({ id: 'div1', label: '', divider: true })
    base.push({ id: 'recent-label', label: t('menu.recentFiles'), sublabel: t('menu.recentFiles'), disabled: true })
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
      { id: 'div3', label: '', divider: true },
      {
        id: 'speed',
        label: t('menu.speed'),
        submenu: [
          { id: 'speed-slow', label: t('menu.speedSlow') },
          { id: 'speed-normal', label: t('menu.speedNormal') },
          { id: 'speed-fast', label: t('menu.speedFast') },
        ],
      },
    ],
  },
  ]
})

// ============================================================
// Dropdown state
// ============================================================

const activeMenuId = ref<string | null>(null)
const activeSubmenuId = ref<string | null>(null)

function onMenuClick(menuId: string) {
  if (activeMenuId.value === menuId) {
    activeMenuId.value = null
  } else {
    activeMenuId.value = menuId
    activeSubmenuId.value = null
  }
}

function onItemClick(itemId: string) {
  activeMenuId.value = null
  activeSubmenuId.value = null
  emit('action', itemId)
}

function onSubmenuEnter(itemId: string) {
  activeSubmenuId.value = itemId
}

function onSubmenuLeave() {
  activeSubmenuId.value = null
}

function onClose() {
  activeMenuId.value = null
  activeSubmenuId.value = null
}

// ============================================================
// Theme toggle
// ============================================================

const { settings } = useSettings()

function toggleTheme() {
  settings.value.theme = settings.value.theme === 'dark' ? 'light' : 'dark'
}

// ============================================================
// Execution controls (merged from ExecutionToolbar)
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

const SPEEDS = [
  { id: 'slow' as const, label: t('execution.speedSlow') },
  { id: 'normal' as const, label: t('execution.speedNormal') },
  { id: 'fast' as const, label: t('execution.speedFast') },
]

// ============================================================
// Click outside → close
// ============================================================

function onDocumentClick() {
  onClose()
}
onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div class="menu-bar" @click.stop>
    <div
      v-for="menu in menus"
      :key="menu.id"
      class="menu-top"
      :class="{ active: activeMenuId === menu.id }"
      @click.stop="onMenuClick(menu.id)"
    >
      <span class="menu-top-label">{{ menu.label }}</span>

      <!-- Dropdown -->
      <div v-if="activeMenuId === menu.id" class="menu-dropdown">
        <template v-for="item in menu.items" :key="item.id">
          <!-- 最近打开的文件 → 灰显标签 -->
          <div
            v-if="item.sublabel && item.disabled"
            class="dropdown-sublabel"
          >
            {{ item.sublabel }}
          </div>

          <!-- 分隔线 -->
          <div v-else-if="item.divider" class="dropdown-divider" />

          <!-- 普通菜单项 -->
          <div
            v-else
            class="dropdown-item"
            :class="{
              disabled: item.disabled,
              'has-submenu': item.submenu,
              'submenu-open': activeSubmenuId === item.id,
            }"
            @mouseenter="item.submenu && onSubmenuEnter(item.id)"
            @mouseleave="item.submenu && onSubmenuLeave()"
            @click.stop="!item.disabled && !item.submenu && onItemClick(item.id)"
          >
            <span class="dropdown-item-label">{{ item.label }}</span>
            <ChevronRight v-if="item.submenu" class="submenu-arrow" :size="10" />

            <!-- 子菜单 -->
            <div
              v-if="item.submenu && activeSubmenuId === item.id"
              class="menu-subdropdown"
            >
              <div
                v-for="sub in item.submenu"
                :key="sub.id"
                class="dropdown-item"
                @click.stop="onItemClick(sub.id)"
              >
                {{ sub.label }}
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Execution toolbar -->
    <div class="menu-bar-sep" />
    <div class="menu-bar-toolbar">
      <!-- Run -->
      <button
        class="menu-tb-btn"
        :disabled="!canRun"
        :title="$t('execution.btnRun')"
        @click.stop="emit('run')"
      >
        <Play :size="14" />
        <span>{{ $t('execution.btnRun') }}</span>
      </button>
      <!-- Step -->
      <button
        class="menu-tb-btn"
        :disabled="!canStep"
        :title="stepLabel"
        @click.stop="emit('step')"
      >
        <StepForward :size="14" />
        <span>{{ stepLabel }}</span>
      </button>
      <!-- Pause / Resume -->
      <button
        class="menu-tb-btn"
        :disabled="!canPause && !isPaused"
        :title="isPaused ? $t('execution.btnResume') : $t('execution.btnPause')"
        @click.stop="onPauseClick"
      >
        <Pause v-if="!isPaused" :size="14" />
        <Play v-else :size="14" />
        <span>{{ isPaused ? $t('execution.btnResume') : $t('execution.btnPause') }}</span>
      </button>
      <!-- Stop -->
      <button
        class="menu-tb-btn"
        :disabled="!canStop"
        :title="$t('execution.btnStop')"
        @click.stop="emit('stop')"
      >
        <Square :size="14" />
        <span>{{ $t('execution.btnStop') }}</span>
      </button>

      <div class="menu-bar-sep" />

      <!-- Speed selector -->
      <div class="menu-tb-speed-group">
        <span class="menu-tb-speed-label">{{ $t('execution.speed') }}</span>
        <button
          v-for="s in SPEEDS"
          :key="s.id"
          class="menu-tb-speed-btn"
          :class="{ active: executionSpeed === s.id }"
          @click.stop="emit('setSpeed', s.id)"
        >
          {{ s.label }}
        </button>
      </div>

      <div class="menu-bar-sep" />

      <!-- Variable monitor toggle -->
      <button
        class="menu-tb-btn"
        :class="{ active: showVariableMonitor }"
        :title="showVariableMonitor ? $t('execution.hideVarMonitor') : $t('execution.showVarMonitor')"
        @click.stop="emit('toggleVariableMonitor')"
      >
        <Table :size="14" />
        <span v-if="showVariableMonitor">{{ $t('execution.hideVarMonitor') }}</span>
      </button>
    </div>

    <!-- Right-aligned buttons -->
    <div class="menu-bar-right">
      <button
        class="theme-toggle-btn"
        :title="settings.theme === 'dark' ? $t('menu.switchToLight') : $t('menu.switchToDark')"
        @click.stop="toggleTheme"
      >
        <Sun v-if="settings.theme === 'dark'" :size="16" />
        <Moon v-else :size="16" />
      </button>
      <button class="settings-btn" :title="$t('common.settings')" @click.stop="emit('action', 'open-settings')">
        <Settings :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ---- Menu bar ---- */
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

/* ---- Top-level menu items ---- */
.menu-top {
  position: relative;
  display: flex;
  align-items: center;
  height: 100%;
}

.menu-top-label {
  padding: 4px 12px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-secondary);
  transition: background 0.1s, color 0.1s;
  white-space: nowrap;
}

.menu-top-label:hover,
.menu-top.active .menu-top-label {
  background: var(--border-color);
  color: var(--text-primary);
}

/* ---- Dropdown ---- */
.menu-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 180px;
  padding: 4px 0;
  background: var(--bg-dropdown);
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
  z-index: 10000;
}

/* ---- Dropdown items ---- */
.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  position: relative;
  transition: background 0.1s;
}

.dropdown-item:hover:not(.disabled) {
  background: var(--bg-menu-hover);
  color: var(--text-primary);
}

.dropdown-item.disabled {
  color: var(--text-nav-disabled);
  cursor: default;
}

.dropdown-item.has-submenu.submenu-open {
  background: var(--bg-menu-hover);
  color: var(--text-primary);
}

.dropdown-item-label {
  flex: 1;
}

.submenu-arrow {
  color: var(--text-muted-2);
  margin-left: 16px;
  flex-shrink: 0;
}

.dropdown-item:hover .submenu-arrow {
  color: var(--text-secondary);
}

/* ---- Divider ---- */
.dropdown-divider {
  height: 1px;
  margin: 4px 12px;
  background: var(--border-medium);
}

/* ---- Sublabel ("最近打开的文件") ---- */
.dropdown-sublabel {
  padding: 4px 16px 2px;
  font-size: 11px;
  color: var(--text-disabled);
  cursor: default;
}

/* ---- Sub-dropdown ---- */
.menu-subdropdown {
  position: absolute;
  left: 100%;
  top: -4px;
  min-width: 120px;
  padding: 4px 0;
  background: var(--bg-dropdown);
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
  z-index: 10001;
}

/* ---- Theme toggle button ---- */
.theme-toggle-btn {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.1s, color 0.1s;
  line-height: 1;
}

.theme-toggle-btn:hover {
  background: var(--bg-menu-hover);
}

/* ---- Settings button ---- */
.menu-bar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  height: 100%;
}

.settings-btn {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.1s, color 0.1s;
  line-height: 1;
}

.settings-btn:hover {
  background: var(--bg-menu-hover);
  color: var(--text-primary);
}

/* ---- Execution toolbar (merged) ---- */
.menu-bar-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 100%;
}

.menu-bar-sep {
  width: 1px;
  height: 16px;
  background: var(--border-soft);
  flex-shrink: 0;
  margin: 0 4px;
}

.menu-tb-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s, color 0.12s;
}

.menu-tb-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.menu-tb-btn.active {
  color: var(--accent);
}

.menu-tb-btn:disabled {
  color: var(--text-nav-disabled);
  cursor: not-allowed;
  opacity: 0.5;
}

.menu-tb-btn:disabled :deep(svg) {
  opacity: 0.35;
}

/* ---- Speed selector ---- */
.menu-tb-speed-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.menu-tb-speed-label {
  font-size: 10px;
  color: var(--text-disabled);
  margin-right: 4px;
}

.menu-tb-speed-btn {
  height: 20px;
  padding: 0 6px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  color: var(--text-muted-2);
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}

.menu-tb-speed-btn:hover {
  background: var(--bg-hover);
  color: var(--text-dim);
}

.menu-tb-speed-btn.active {
  background: var(--bg-speed-active, rgba(79, 195, 247, 0.15));
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}
</style>
