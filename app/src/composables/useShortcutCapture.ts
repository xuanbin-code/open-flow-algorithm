// ============================================================
// useShortcutCapture.ts — 快捷键捕获状态机
//
// 管理"录制模式"的生命周期：开始捕获 → 等待按键 → 确认/取消。
// 由 SettingsDialog 的 Shortcuts 面板消费。
// ============================================================

import { ref, type Ref } from 'vue'
import type { ShortcutActionId, ShortcutCombo } from '../types/shortcuts'
import { comboFromKeyEvent, isModifierKey } from '../types/shortcuts'

export function useShortcutCapture() {
  /** 是否正在录制 */
  const isRecording: Ref<boolean> = ref(false)

  /** 当前正在绑定的 action ID */
  const capturingActionId: Ref<ShortcutActionId | null> = ref(null)

  /** 已捕获的 combo（确认前） */
  const capturedCombo: Ref<ShortcutCombo | null> = ref(null)

  /** 验证错误信息（如冲突） */
  const captureError: Ref<string | null> = ref(null)

  /** 开始捕获指定 action 的快捷键 */
  function startCapture(actionId: ShortcutActionId): void {
    isRecording.value = true
    capturingActionId.value = actionId
    capturedCombo.value = null
    captureError.value = null
  }

  /**
   * 捕获期间的 keydown 处理。
   * 调用方应在 window 上注册此处理函数（capture phase）。
   * 返回 true 表示事件已被消费（调用方应 e.preventDefault）。
   */
  function onCaptureKeydown(e: KeyboardEvent): boolean {
    if (!isRecording.value) return false

    // Escape → 取消捕获
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cancelCapture()
      return true
    }

    // 忽略纯修饰键
    if (isModifierKey(e)) {
      e.preventDefault()
      return true
    }

    // 构建 combo
    e.preventDefault()
    e.stopPropagation()
    capturedCombo.value = comboFromKeyEvent(e)
    return true
  }

  /** 确认捕获，返回 combo 并重置状态 */
  function confirmCapture(): ShortcutCombo | null {
    const combo = capturedCombo.value
    isRecording.value = false
    capturingActionId.value = null
    capturedCombo.value = null
    captureError.value = null
    return combo
  }

  /** 取消捕获，丢弃当前 combo */
  function cancelCapture(): void {
    isRecording.value = false
    capturingActionId.value = null
    capturedCombo.value = null
    captureError.value = null
  }

  return {
    isRecording,
    capturingActionId,
    capturedCombo,
    captureError,
    startCapture,
    onCaptureKeydown,
    confirmCapture,
    cancelCapture,
  }
}
