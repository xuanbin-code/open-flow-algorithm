// ============================================================
// useKeyboardShortcuts.ts — 全局键盘快捷键 composable
//
// 从 shortcutStore 读取快捷键映射进行动态匹配，
// 替代原有的硬编码 if 链。调用方负责在 onMounted
// /onUnmounted 中绑定/解绑 window keydown 监听器。
// ============================================================

import type { ComputedRef, Ref } from 'vue'
import { useShortcutStore } from '../stores/shortcuts'
import type { ShortcutCombo } from '../types/shortcuts'
import { comboFromKeyEvent, comboMatch, isEditableTarget } from '../types/shortcuts'

export interface UseKeyboardShortcutsOptions {
  /** 是否正在执行，运行中阻止编辑类快捷键 */
  isExecuting: ComputedRef<boolean>
  /** 当前选中节点 ID，用于判断 Delete 是否可用 */
  selectedNodeId: Ref<string | null>
  // --- 必须的操作处理器 ---
  handleSave: () => Promise<void>
  undo: () => void
  redo: () => void
  deleteSelectedNode: () => void
  // --- 可选的操作处理器（新增快捷键绑定） ---
  handleNew?: () => void
  handleOpen?: () => Promise<void>
  run?: () => void
  step?: () => void
  stop?: () => void
}

/** 内部 handler 映射条目 */
interface HandlerEntry {
  actionId: string          // 调试用
  combo: ShortcutCombo
  handler: () => void
  /** 该快捷键是否在 isExecuting 时也被允许（当前只有 save） */
  allowWhenExecuting?: boolean
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const store = useShortcutStore()

  /**
   * 根据 store 中的快捷键映射构建 handler 查找表。
   * 每次调用时重新构建（因为 store.shortcuts 是 reactive 的）。
   */
  function buildEntries(): HandlerEntry[] {
    const s = store.shortcuts
    const entries: HandlerEntry[] = []

    // save ← shortcuts.save
    entries.push({ actionId: 'save',           combo: s.save,           handler: () => options.handleSave(),           allowWhenExecuting: true })

    // undo ← shortcuts.undo
    entries.push({ actionId: 'undo',           combo: s.undo,           handler: () => options.undo() })

    // redo ← shortcuts.redo (Ctrl+Y) + redoAlt (Ctrl+Shift+Z)
    entries.push({ actionId: 'redo',           combo: s.redo,           handler: () => options.redo() })
    entries.push({ actionId: 'redoAlt',        combo: s.redoAlt,        handler: () => options.redo() })

    // deleteSelected ← shortcuts.deleteSelected（仅在 selectedNodeId 非空时生效）
    entries.push({ actionId: 'deleteSelected', combo: s.deleteSelected, handler: () => { if (options.selectedNodeId.value) options.deleteSelectedNode() } })

    // Backspace — 始终作为 Delete 的补充快捷键（硬编码），绕过 VueFlow 内置 Backspace 处理
    entries.push({ actionId: 'deleteSelected', combo: { ctrl: false, shift: false, alt: false, meta: false, key: 'Backspace', code: 'Backspace' }, handler: () => { if (options.selectedNodeId.value) options.deleteSelectedNode() } })

    // 可选处理器
    if (options.handleNew)  entries.push({ actionId: 'new',  combo: s.new,  handler: () => options.handleNew!() })
    if (options.handleOpen) entries.push({ actionId: 'open', combo: s.open, handler: () => options.handleOpen!() })
    if (options.run)        entries.push({ actionId: 'run',  combo: s.run,  handler: () => options.run!() })
    if (options.step)       entries.push({ actionId: 'step', combo: s.step, handler: () => options.step!() })
    if (options.stop)       entries.push({ actionId: 'stop', combo: s.stop, handler: () => options.stop!() })

    return entries
  }

  function onKeydown(e: KeyboardEvent) {
    // 全局快捷键暂停（设置窗口打开时）
    if (store.shortcutsPaused) return

    // 焦点在输入框中 → 交给浏览器处理原生快捷键
    if (isEditableTarget(e)) return

    const pressed = comboFromKeyEvent(e)
    const entries = buildEntries()

    for (const entry of entries) {
      if (comboMatch(entry.combo, pressed)) {
        // 运行中仅允许 save（防止误操作）
        if (options.isExecuting.value && !entry.allowWhenExecuting) {
          // save 在运行中被静默忽略（e.preventDefault 仍需调用）
          if (entry.allowWhenExecuting) {
            e.preventDefault()
          }
          continue
        }

        e.preventDefault()
        entry.handler()
        return // 找到匹配后停止，避免组合键触发多个 handler
      }
    }
  }

  return { onKeydown }
}
