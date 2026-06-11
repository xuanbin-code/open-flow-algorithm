<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSettings } from '../composables/useSettings'
import { Sun, Moon, Settings, ChevronRight } from './icons'

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
}>()

const emit = defineEmits<{
  action: [menuId: string]
}>()

// ============================================================
// Menu data (dynamic file menu with recent files)
// ============================================================

const menuFileItems = computed<MenuItem[]>(() => {
  const base: MenuItem[] = [
    { id: 'new', label: '新建' },
    { id: 'open', label: '打开' },
    { id: 'save', label: '保存' },
    { id: 'saveAs', label: '另存为' },
  ]

  const recents = props.recentFiles ?? []
  if (recents.length > 0) {
    base.push({ id: 'div1', label: '', divider: true })
    base.push({ id: 'recent-label', label: '最近打开的文件', sublabel: '最近打开的文件', disabled: true })
    for (const entry of recents) {
      base.push({ id: `open-recent:${entry.path}`, label: entry.name })
    }
  }

  base.push({ id: 'div-close', label: '', divider: true })
  base.push({ id: 'exit', label: '退出' })
  return base
})

const menus = computed<TopMenu[]>(() => {
  const es = props.executionStatus ?? 'idle'

  return [
  {
    id: 'file',
    label: '文件',
    items: menuFileItems.value,
  },
  {
    id: 'edit',
    label: '编辑',
    items: [
      { id: 'delete', label: '删除', disabled: true },
      { id: 'undo', label: '撤销' },
      { id: 'redo', label: '重做' },
    ],
  },
  {
    id: 'program',
    label: '程序',
    items: [
      { id: 'run', label: '运行', disabled: es === 'running' || es === 'waiting-input' },
      { id: 'step', label: '步进', disabled: es === 'running' || es === 'waiting-input' },
      { id: 'stop', label: '终止', disabled: es === 'idle' || es === 'stopped' },
      { id: 'div3', label: '', divider: true },
      {
        id: 'speed',
        label: '运行速度',
        submenu: [
          { id: 'speed-slow', label: '慢速' },
          { id: 'speed-normal', label: '正常' },
          { id: 'speed-fast', label: '快速' },
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

    <!-- Right-aligned buttons -->
    <div class="menu-bar-right">
      <button
        class="theme-toggle-btn"
        :title="settings.theme === 'dark' ? '切换浅色模式' : '切换深色模式'"
        @click.stop="toggleTheme"
      >
        <Sun v-if="settings.theme === 'dark'" :size="16" />
        <Moon v-else :size="16" />
      </button>
      <button class="settings-btn" title="设置" @click.stop="emit('action', 'open-settings')">
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
</style>
