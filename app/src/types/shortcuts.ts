// ============================================================
// types/shortcuts.ts — 快捷键数据模型
//
// 定义可配置快捷键的类型、默认值和工具函数。
// 使用 e.code（物理键位）进行匹配，免疫键盘布局差异。
// ============================================================

/** 可绑定快捷键的操作 ID */
export type ShortcutActionId =
  | 'save'
  | 'undo'
  | 'redo'
  | 'deleteSelected'
  | 'new'
  | 'open'
  | 'run'
  | 'step'
  | 'stop'

/** 键盘组合（可序列化） */
export interface ShortcutCombo {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  /** e.key — 特殊键的显示名，如 "Delete"、"F5" */
  key: string
  /** e.code — 物理键位，如 "KeyS"、"Delete"、"F5" */
  code: string
}

/** redo 的替代绑定 ID（非独立 action，内部使用） */
export type RedoAltKey = 'redoAlt'

/** 存储的快捷键映射（含 redoAlt 备用绑定） */
export type ShortcutMap = Record<ShortcutActionId | RedoAltKey, ShortcutCombo>

// ============================================
// 默认快捷键定义
// ============================================

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  save:           { ctrl: true,  shift: false, alt: false, meta: false, key: 's',       code: 'KeyS' },
  undo:           { ctrl: true,  shift: false, alt: false, meta: false, key: 'z',       code: 'KeyZ' },
  redo:           { ctrl: true,  shift: false, alt: false, meta: false, key: 'y',       code: 'KeyY' },
  redoAlt:        { ctrl: true,  shift: true,  alt: false, meta: false, key: 'z',       code: 'KeyZ' },
  deleteSelected: { ctrl: false, shift: false, alt: false, meta: false, key: 'Delete',  code: 'Delete' },
  new:            { ctrl: true,  shift: false, alt: false, meta: false, key: 'n',       code: 'KeyN' },
  open:           { ctrl: true,  shift: false, alt: false, meta: false, key: 'o',       code: 'KeyO' },
  run:            { ctrl: false, shift: false, alt: false, meta: false, key: 'F5',      code: 'F5' },
  step:           { ctrl: false, shift: false, alt: false, meta: false, key: 'F6',      code: 'F6' },
  stop:           { ctrl: false, shift: false, alt: false, meta: false, key: 'F7',      code: 'F7' },
}

// ============================================
// 工具函数
// ============================================

/** code → 显示名映射表 */
const CODE_DISPLAY: Record<string, string> = {
  Delete: 'Delete',
  Backspace: 'Backspace',
  Enter: 'Enter',
  Escape: 'Escape',
  Tab: 'Tab',
  Space: 'Space',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  F1: 'F1',  F2: 'F2',  F3: 'F3',  F4: 'F4',
  F5: 'F5',  F6: 'F6',  F7: 'F7',  F8: 'F8',
  F9: 'F9',  F10: 'F10', F11: 'F11', F12: 'F12',
}

/** 将 ShortcutCombo 转为可读字符串，如 "Ctrl+S"、"F5"、"Ctrl+Shift+Z" */
export function comboToString(combo: ShortcutCombo): string {
  const parts: string[] = []
  if (combo.ctrl)  parts.push('Ctrl')
  if (combo.shift) parts.push('Shift')
  if (combo.alt)   parts.push('Alt')
  if (combo.meta)  parts.push('Meta')

  const displayKey = CODE_DISPLAY[combo.code]
    ?? (combo.code.startsWith('Key') ? combo.code.slice(3) : combo.code)
  parts.push(displayKey)
  return parts.join('+')
}

/** 从 KeyboardEvent 提取 ShortcutCombo */
export function comboFromKeyEvent(e: KeyboardEvent): ShortcutCombo {
  return {
    ctrl:  e.ctrlKey || e.metaKey,
    shift: e.shiftKey,
    alt:   e.altKey,
    meta:  e.metaKey,
    key:   e.key,
    code:  e.code,
  }
}

/**
 * 判断两个 ShortcutCombo 是否匹配（用于 keydown 处理时查找绑定）
 * 只用 code + modifier flags 匹配，忽略 key（因为 key 随键盘布局变化）。
 */
export function comboMatch(a: ShortcutCombo, b: ShortcutCombo): boolean {
  return a.code === b.code
    && a.ctrl  === b.ctrl
    && a.shift === b.shift
    && a.alt   === b.alt
    && a.meta  === b.meta
}

/** 严格相等判断（含 key 字段，用于冲突检测） */
export function comboEquals(a: ShortcutCombo, b: ShortcutCombo): boolean {
  return comboMatch(a, b) && a.key === b.key
}

/**
 * 检查事件是否来自可编辑元素（输入框等），
 * 在此类元素中应跳过全局快捷键处理。
 */
export function isEditableTarget(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    || (e.target as HTMLElement)?.isContentEditable
}

/**
 * 检查是否为纯修饰键（Ctrl/Shift/Alt/Meta 单独按下）。
 * 快捷键捕获时应忽略这些键。
 */
export function isModifierKey(e: KeyboardEvent): boolean {
  return ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)
}
