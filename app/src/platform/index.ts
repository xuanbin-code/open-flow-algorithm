// ============================================================
// 平台适配器 — 统一入口
// ============================================================

import type { PlatformFileSystem, FileDialogFilter, FileOpenResult, RecentEntry } from './types'
import { tauriFileSystem } from './tauri-adapter'
import { webFileSystem } from './web-adapter'

// Re-export types for consumers
export type { FileDialogFilter, FileOpenResult, RecentEntry }

// ============================================================
// 平台检测
// ============================================================

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

const fs: PlatformFileSystem = isTauri() ? tauriFileSystem : webFileSystem

// ============================================================
// 导出平台无关的 API
// ============================================================

export const showOpenDialog = fs.showOpenDialog.bind(fs)
export const showSaveDialog = fs.showSaveDialog.bind(fs)
export const readFile = fs.readFile.bind(fs)
export const writeFile = fs.writeFile.bind(fs)
export const loadRecentFiles = fs.loadRecentFiles.bind(fs)
export const saveRecentFiles = fs.saveRecentFiles.bind(fs)

// ============================================================
// 最近文件辅助函数（跨平台通用逻辑）
// ============================================================

const MAX_ENTRIES = 20

/** 添加文件到最近打开列表 */
export async function addRecentFile(path: string): Promise<RecentEntry[]> {
  const list = await loadRecentFiles()
  const name = path.split(/[/\\]/).pop() ?? path
  const entry: RecentEntry = { path, name, openedAt: new Date().toISOString() }
  const filtered = list.filter(e => e.path !== path)
  filtered.unshift(entry)
  const trimmed = filtered.slice(0, MAX_ENTRIES)
  await saveRecentFiles(trimmed)
  return trimmed
}

/** 获取最近打开的第一个文件路径 */
export async function getLastFile(): Promise<string | null> {
  const list = await loadRecentFiles()
  return list.length > 0 ? list[0].path : null
}
