<script setup lang="ts">
import { ref } from 'vue'
import type { FunctionDef } from '../engine/fprg-ast'
import { Clipboard, Plus } from './icons'

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
// Context menu
// ============================================================

const contextMenu = ref<{
  visible: boolean
  x: number
  y: number
  funcName: string
}>({ visible: false, x: 0, y: 0, funcName: '' })

function onContextMenu(e: MouseEvent, funcName: string) {
  e.preventDefault()
  contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, funcName }
  document.addEventListener('click', closeContextMenu, { once: true })
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

function handleRename() {
  const oldName = contextMenu.value.funcName
  closeContextMenu()
  const newName = prompt('重命名函数:', oldName)
  if (newName && newName.trim() && newName.trim() !== oldName) {
    emit('renameFunction', oldName, newName.trim())
  }
}

function handleDelete() {
  const name = contextMenu.value.funcName
  closeContextMenu()
  if (confirm(`确定删除函数 "${name}"？此操作不可撤销。`)) {
    emit('deleteFunction', name)
  }
}

function handleDuplicate() {
  const oldName = contextMenu.value.funcName
  closeContextMenu()
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
  <div class="fn-sidebar">
    <!-- Header -->
    <div class="fn-sidebar-header">
      <span class="fn-sidebar-title">{{ $t('functions.title') }}</span>
    </div>

    <!-- Tab list -->
    <div class="fn-tab-list">
      <button
        v-for="func in functions"
        :key="func.name"
        class="fn-tab"
        :class="{ active: func.name === activeFunction }"
        :title="func.name"
        @click="emit('switchFunction', func.name)"
        @contextmenu="onContextMenu($event, func.name)"
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
    </div>

    <!-- Add button -->
    <button
      class="fn-add-btn"
      @click="emit('addFunction')"
      :title="$t('functions.newFunction')"
    >
      <Plus :size="14" />
      <span>{{ $t('functions.newFunction') }}</span>
    </button>

    <!-- Context menu -->
    <div
      v-if="contextMenu.visible"
      class="tab-context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <button class="ctx-item" @click="handleRename">
        重命名
      </button>
      <button class="ctx-item" @click="handleDuplicate">
        <Clipboard :size="12" />
        复制
      </button>
      <div class="ctx-divider" />
      <button
        class="ctx-item ctx-item-danger"
        :disabled="contextMenu.funcName === 'Main'"
        @click="handleDelete"
      >
        删除
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ---- Sidebar container ---- */
.fn-sidebar {
  display: flex;
  flex-direction: column;
  width: 150px;
  min-width: 150px;
  height: 100%;
  flex-shrink: 0;
  background: var(--bg-panel);
  border-right: 1px solid var(--border-soft);
  user-select: none;
  overflow: hidden;
}

/* ---- Header ---- */
.fn-sidebar-header {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}

.fn-sidebar-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ---- Tab list ---- */
.fn-tab-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
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
  height: 30px;
  padding: 0 10px;
  background: transparent;
  border: none;
  border-left: 3px solid transparent;
  color: var(--text-muted);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  text-align: left;
  flex-shrink: 0;
}

.fn-tab:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.fn-tab.active {
  color: var(--text-primary);
  border-left-color: var(--accent);
  background: var(--bg-hover-strong);
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

/* ---- Add button ---- */
.fn-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  margin: 4px 8px;
  background: transparent;
  border: 1px dashed var(--border-soft);
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  flex-shrink: 0;
}

.fn-add-btn:hover {
  background: var(--bg-hover);
  color: var(--accent);
  border-color: var(--accent);
}

/* ---- Context menu ---- */
.tab-context-menu {
  position: fixed;
  z-index: 10002;
  background: var(--bg-float-panel-95, rgba(35, 35, 45, 0.95));
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  padding: 4px;
  min-width: 140px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}

.ctx-item:hover {
  background: var(--bg-hover);
}

.ctx-item:disabled {
  color: var(--text-disabled);
  cursor: not-allowed;
}

.ctx-item:disabled:hover {
  background: transparent;
}

.ctx-item-danger {
  color: #e74c3c;
}

.ctx-item-danger:hover {
  background: rgba(231, 76, 60, 0.12);
}

.ctx-divider {
  height: 1px;
  margin: 3px 8px;
  background: var(--border-soft);
}
</style>
