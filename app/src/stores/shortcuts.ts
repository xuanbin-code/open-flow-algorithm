// ============================================================
// stores/shortcuts.ts — 快捷键持久化 Store
//
// 管理可配置的键盘快捷键，持久化到 localStorage。
// 参考 stores/settings.ts 的同构 Pinia setup store 模式。
// ============================================================

import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { ShortcutActionId, ShortcutMap, ShortcutCombo } from '../types/shortcuts'
import { DEFAULT_SHORTCUTS } from '../types/shortcuts'

const STORAGE_KEY = 'flowgorithm-shortcuts'

// ============================================
// localStorage 读写
// ============================================

function load(): ShortcutMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const merged = { ...DEFAULT_SHORTCUTS }
      for (const key of Object.keys(parsed)) {
        // 只合并已知 actionId，忽略未知字段（兼容未来扩展）
        if (key in merged && parsed[key] && typeof parsed[key].code === 'string') {
          merged[key as ShortcutActionId] = parsed[key]
        }
      }
      return merged
    }
  } catch {
    // localStorage 数据损坏，使用默认值
  }
  return { ...DEFAULT_SHORTCUTS }
}

function persist(map: ShortcutMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // 忽略存储失败（隐私模式等）
  }
}

// ============================================
// Store
// ============================================

export const useShortcutStore = defineStore('shortcuts', () => {
  // --- 状态 ---
  const shortcuts = ref<ShortcutMap>(load())

  /** 当为 true 时暂停全局快捷键处理（设置窗口打开时使用） */
  const shortcutsPaused = ref(false)

  // --- 自动持久化 ---
  watch(shortcuts, (newMap) => persist(newMap), { deep: true })

  // --- 操作 ---

  /** 更新指定操作的快捷键 */
  function updateShortcut(actionId: ShortcutActionId, combo: ShortcutCombo): void {
    shortcuts.value[actionId] = { ...combo }
  }

  /** 将指定操作的快捷键重置为默认值 */
  function resetShortcut(actionId: ShortcutActionId): void {
    shortcuts.value[actionId] = { ...DEFAULT_SHORTCUTS[actionId] }
  }

  /** 将所有快捷键重置为默认值 */
  function resetAllShortcuts(): void {
    // 深拷贝默认值，避免引用共享
    Object.assign(shortcuts.value, JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS)))
  }

  return {
    shortcuts,
    shortcutsPaused,
    updateShortcut,
    resetShortcut,
    resetAllShortcuts,
  }
})

/** 在 Pinia 挂载前初始化 store 并触发 load（FOUC 防护不必需，但与 settings store 初始化保持一致） */
export function initShortcutStore(pinia: ReturnType<typeof import('pinia').createPinia>): ReturnType<typeof useShortcutStore> {
  const store = useShortcutStore(pinia)
  return store
}
