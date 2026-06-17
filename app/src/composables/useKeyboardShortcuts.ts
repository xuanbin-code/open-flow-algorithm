// ============================================================
// useKeyboardShortcuts.ts — 全局键盘快捷键 composable
//
// 处理 Ctrl+S / Ctrl+Z / Ctrl+Y / Delete / Backspace 快捷键。
// 调用方负责在 onMounted/onUnmounted 中绑定/解绑。
// ============================================================

import type { ComputedRef, Ref } from 'vue'

export interface UseKeyboardShortcutsOptions {
  isExecuting: ComputedRef<boolean>
  selectedNodeId: Ref<string | null>
  handleSave: () => Promise<void>
  undo: () => void
  redo: () => void
  deleteSelectedNode: () => void
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const { isExecuting, selectedNodeId, handleSave, undo, redo, deleteSelectedNode } = options

  function onKeydown(e: KeyboardEvent) {
    // 焦点在输入框中 → 交给浏览器处理原生快捷键（如 Ctrl+Z 文本撤销）
    const ae = document.activeElement
    if (
      ae &&
      (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' ||
       (ae as HTMLElement).isContentEditable)
    ) {
      return
    }

    // 运行时不响应编辑快捷键（Ctrl+S 除外：运行中不允许保存）
    if (isExecuting.value) {
      // 仍允许 Ctrl+S 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        return // 静默忽略
      }
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
    // Ctrl+Z → 撤销
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
      e.preventDefault()
      undo()
    }
    // Ctrl+Y (或 Ctrl+Shift+Z) → 重做
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
      e.preventDefault()
      redo()
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId.value) {
      e.preventDefault()
      deleteSelectedNode()
    }
  }

  return { onKeydown }
}
