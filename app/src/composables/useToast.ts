// ============================================================
// useToast.ts — Toast 通知 composable
//
// 管理全局 Toast 消息的显示/隐藏状态。
// ============================================================

import { reactive } from 'vue'

export interface ToastState {
  message: string
  type: 'success' | 'error'
  visible: boolean
}

export function useToast() {
  const toast = reactive<ToastState>({ message: '', type: 'success', visible: false })
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    toast.message = message
    toast.type = type
    toast.visible = true
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toast.visible = false }, 3000)
  }

  function hideToast() {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null }
    toast.visible = false
  }

  return { toast, showToast, hideToast }
}
