// ============================================================
// Recent Files Store — 集中管理最近打开的文件列表
// 通过平台适配器持久化（Web: localStorage, Tauri: app data dir）
// ============================================================

import { ref } from 'vue'
import { defineStore } from 'pinia'
import { loadRecentFiles, saveRecentFiles, addRecentFile as platformAddRecentFile, type RecentEntry } from '@/platform'

export type { RecentEntry }

export const useRecentFilesStore = defineStore('recentFiles', () => {
  // ── State ──
  const files = ref<RecentEntry[]>([])

  // ── Actions ──

  async function load() {
    try {
      files.value = await loadRecentFiles()
    } catch {
      files.value = []
    }
  }

  async function addFile(path: string) {
    files.value = await platformAddRecentFile(path)
  }

  async function removeFile(path: string) {
    files.value = files.value.filter(f => f.path !== path)
    await saveRecentFiles(files.value)
  }

  async function clearAll() {
    files.value = []
    await saveRecentFiles([])
  }

  return { files, load, addFile, removeFile, clearAll }
})
