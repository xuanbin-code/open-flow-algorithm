<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { FunctionDef } from '../engine/fprg-ast'
import { Clipboard, Plus, ChevronLeft, ChevronRight } from './icons'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  functions: FunctionDef[]
  activeFunction: string
}>()

const emit = defineEmits<{
  switchFunction: [name: string]
  addFunction: []
  renameFunction: [oldName: string, newName: string]
  deleteFunction: [name: string]
}>()

// ============================================================
// Collapse state
// ============================================================

const collapsed = ref(false)

function onToggleCollapse() {
  collapsed.value = !collapsed.value
}

// 折叠态点击时：先展开，再执行操作
async function onTabClick(funcName: string) {
  if (collapsed.value) {
    collapsed.value = false
    await nextTick()
  }
  emit('switchFunction', funcName)
}

async function onAddClick() {
  if (collapsed.value) {
    collapsed.value = false
    await nextTick()
  }
  emit('addFunction')
}

// ============================================================
// Context menu actions
// ============================================================

function handleRename(oldName: string) {
  const newName = prompt('重命名函数:', oldName)
  if (newName && newName.trim() && newName.trim() !== oldName) {
    emit('renameFunction', oldName, newName.trim())
  }
}

function handleDelete(name: string) {
  if (confirm(`确定删除函数 "${name}"？此操作不可撤销。`)) {
    emit('deleteFunction', name)
  }
}

function handleDuplicate(oldName: string) {
  const newName = prompt('复制为:', `${oldName}_copy`)
  if (newName && newName.trim()) {
    emit('renameFunction', oldName, newName.trim())
  }
}

// ============================================================
// Double-click to rename
// ============================================================

function onDblClickTab(funcName: string) {
  if (funcName === 'Main') return
  const newName = prompt('重命名函数:', funcName)
  if (newName && newName.trim() && newName.trim() !== funcName) {
    emit('renameFunction', funcName, newName.trim())
  }
}
</script>

<template>
  <div class="fn-sidebar" :class="{ collapsed }">
    <!-- Header (collapse toggle integrated) -->
    <div class="fn-sidebar-header">
      <span v-if="!collapsed" class="fn-sidebar-title">{{ $t('functions.title') }}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        class="fn-collapse-btn"
        :title="collapsed ? '展开侧边栏' : '折叠侧边栏'"
        @click="onToggleCollapse"
      >
        <ChevronLeft v-if="!collapsed" :size="13" />
        <ChevronRight v-else :size="13" />
      </Button>
    </div>

    <!-- Tab list -->
    <div class="fn-tab-list">
      <ContextMenu v-for="func in functions" :key="func.name">
        <ContextMenuTrigger as-child>
          <button
            class="fn-tab"
            :class="{ active: func.name === activeFunction }"
            :title="func.name"
            @click="onTabClick(func.name)"
            @dblclick="onDblClickTab(func.name)"
          >
            <Clipboard :size="13" class="fn-tab-icon" />
            <span class="fn-tab-name">{{ func.name }}</span>
            <span
              v-if="func.parameters.length > 0"
              class="fn-tab-param-hint"
            >
              ({{ func.parameters.length }})
            </span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent class="w-36">
          <ContextMenuItem @select="handleRename(func.name)">
            重命名
          </ContextMenuItem>
          <ContextMenuItem @select="handleDuplicate(func.name)">
            <Clipboard :size="12" class="mr-2" />
            复制
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            class="text-destructive focus:bg-destructive/10 focus:text-destructive"
            :disabled="func.name === 'Main'"
            @select="handleDelete(func.name)"
          >
            删除
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>

    <!-- Add button -->
    <Button
      variant="ghost"
      class="fn-add-btn"
      @click="onAddClick"
      :title="$t('functions.newFunction')"
    >
      <Plus :size="14" />
      <span class="fn-add-label">{{ $t('functions.newFunction') }}</span>
    </Button>
  </div>
</template>

<style scoped>
/* ---- Sidebar container ---- */
.fn-sidebar {
  display: flex;
  flex-direction: column;
  width: 190px;
  min-width: 190px;
  height: 100%;
  flex-shrink: 0;
  background: var(--bg-rail);
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  user-select: none;
  overflow: hidden;
  transition: width 0.25s ease, min-width 0.25s ease, background 0.2s ease;
}

.fn-sidebar.collapsed {
  width: 54px;
  min-width: 54px;
}

/* ---- Header ---- */
.fn-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 44px;
  padding: 0 8px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}

.fn-sidebar-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-right: auto;
  padding-left: 8px;
}

.fn-collapse-btn {
  flex-shrink: 0;
}

/* ---- Tab list ---- */
.fn-tab-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  gap: 3px;
  padding: 8px;
}

.fn-tab-list::-webkit-scrollbar {
  width: 3px;
}

.fn-tab-list::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 2px;
}

/* ---- Individual tab ---- */
.fn-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 10px;
  background: transparent;
  border: none;
  border-radius: 7px;
  color: var(--text-muted);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s, color 0.12s, border-color 0.12s, padding 0.25s ease;
  text-align: left;
  flex-shrink: 0;
  width: 100%;
}

.fn-tab:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.fn-tab.active {
  color: var(--text-primary);
  background: var(--bg-hover-strong);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent);
}

.fn-tab-icon {
  color: var(--text-muted-2);
  flex-shrink: 0;
}

.fn-tab.active .fn-tab-icon {
  color: var(--accent);
}

.fn-tab-name {
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fn-tab.active .fn-tab-name {
  font-weight: 600;
}

.fn-tab-param-hint {
  font-size: 10px;
  color: var(--text-muted-3);
  font-weight: 400;
  flex-shrink: 0;
}

/* ---- Collapsed tab: hide icon & hint, center name ---- */
.fn-sidebar.collapsed .fn-tab {
  padding: 0 6px;
  gap: 0;
  justify-content: center;
  font-size: 11px;
}

.fn-sidebar.collapsed .fn-tab-icon {
  display: none;
}

.fn-sidebar.collapsed .fn-tab-param-hint {
  display: none;
}

.fn-sidebar.collapsed .fn-tab.active {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 24%, transparent);
}

/* ---- Add button ---- */
.fn-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  margin: 8px;
  border: 1px dashed var(--border-medium) !important;
  border-radius: 8px;
  color: var(--text-dim) !important;
  font-size: 11px;
  transition: margin 0.25s ease;
  flex-shrink: 0;
}

.fn-add-btn:hover {
  border-color: var(--accent) !important;
  color: var(--accent) !important;
}

.fn-add-label {
  white-space: nowrap;
}

/* ---- Collapsed add button: icon only ---- */
.fn-sidebar.collapsed .fn-add-btn {
  margin: 4px 6px;
  border-style: solid !important;
}

.fn-sidebar.collapsed .fn-add-label {
  display: none;
}
</style>
