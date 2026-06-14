// ============================================================
// Tauri 平台适配器 — 包装 @tauri-apps/* API
// ============================================================

import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import type { PlatformFileSystem, FileDialogFilter, RecentEntry } from './types'

const RECENT_FILE_NAME = 'recent-files.json'

console.log('[platform] 使用 Tauri 原生文件系统适配器')

export const tauriFileSystem: PlatformFileSystem = {
  async showOpenDialog(filters?: FileDialogFilter[]) {
    const selected = await open({
      filters: filters?.map(f => ({ name: f.name, extensions: f.extensions })),
      multiple: false,
    })
    if (!selected) return null
    const content = await readTextFile(selected as string)
    return { content, filePath: selected as string }
  },

  async showSaveDialog(filters?: FileDialogFilter[], content?: string) {
    const savePath = await save({
      filters: filters?.map(f => ({ name: f.name, extensions: f.extensions })),
    })
    if (!savePath) return null
    if (content !== undefined) {
      await writeTextFile(savePath as string, content)
    }
    return savePath as string
  },

  async readFile(filePath: string) {
    return readTextFile(filePath)
  },

  async writeFile(filePath: string, content: string) {
    await writeTextFile(filePath, content)
  },

  async loadRecentFiles() {
    try {
      const raw = await readTextFile(RECENT_FILE_NAME, { baseDir: BaseDirectory.Resource })
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as RecentEntry[]) : []
    } catch {
      return []
    }
  },

  async saveRecentFiles(list: RecentEntry[]) {
    try {
      await writeTextFile(
        RECENT_FILE_NAME,
        JSON.stringify(list, null, 2),
        { baseDir: BaseDirectory.Resource },
      )
    } catch (e) {
      console.error('[tauri-adapter] saveRecentFiles failed:', e)
    }
  },
}
