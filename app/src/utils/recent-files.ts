// ============================================================
// recent-files.ts — 文件打开历史管理器
//
// 在可执行文件同级目录（BaseDirectory.Resource）下维护
// recent-files.json，记录用户最近打开的文件。
// 最多保留 20 条，自动去重，最新在前。
// ============================================================

import { readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'

export interface RecentEntry {
  /** 文件完整绝对路径 */
  path: string
  /** 文件名（仅展示用） */
  name: string
  /** ISO 时间字符串 */
  openedAt: string
}

const MAX_ENTRIES = 20
const FILE_NAME = 'recent-files.json'
const BASE_DIR = BaseDirectory.Resource

// ---- Public API ----

/**
 * 从磁盘读取最近文件列表。
 * 文件不存在或格式错误时返回空数组。
 */
export async function loadRecentFiles(): Promise<RecentEntry[]> {
  try {
    const raw = await readTextFile(FILE_NAME, { baseDir: BASE_DIR })
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed as RecentEntry[]
    }
    return []
  } catch {
    return []
  }
}

/**
 * 将最近文件列表写入磁盘。
 */
export async function saveRecentFiles(list: RecentEntry[]): Promise<void> {
  try {
    const json = JSON.stringify(list, null, 2)
    await writeTextFile(FILE_NAME, json, { baseDir: BASE_DIR })
  } catch (e) {
    console.error('[recent-files] 保存失败:', e)
  }
}

/**
 * 添加一个文件到历史记录（自动去重、排序、截断），返回更新后的列表。
 * 同时自动写入磁盘。
 */
export async function addRecentFile(path: string): Promise<RecentEntry[]> {
  const list = await loadRecentFiles()

  // 提取文件名
  const name = path.split(/[/\\]/).pop() ?? path

  const entry: RecentEntry = {
    path,
    name,
    openedAt: new Date().toISOString(),
  }

  // 去重：移除同路径的旧条目
  const filtered = list.filter(e => e.path !== path)

  // 新条目放在最前
  filtered.unshift(entry)

  // 最多保留 MAX_ENTRIES 条
  const trimmed = filtered.slice(0, MAX_ENTRIES)

  await saveRecentFiles(trimmed)
  return trimmed
}

/**
 * 获取最近一次打开的文件路径。
 * 无历史记录时返回 null。
 */
export async function getLastFile(): Promise<string | null> {
  const list = await loadRecentFiles()
  return list.length > 0 ? list[0].path : null
}
