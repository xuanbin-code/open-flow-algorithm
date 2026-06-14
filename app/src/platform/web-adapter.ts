// ============================================================
// Web 平台适配器 — File System Access API + localStorage
// ============================================================

import type { PlatformFileSystem, FileDialogFilter, FileOpenResult, RecentEntry } from './types'

const RECENT_KEY = 'flowgorithm-recent-files'
const MAX_RECENT = 20

/** 映射 filePath → FileSystemFileHandle，用于后续 readFile/writeFile */
const handleMap = new Map<string, FileSystemFileHandle>()

function supportsFileSystemAccess(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof window !== 'undefined' && 'showOpenFilePicker' in (window as any)
}

// ============================================================
// 降级方案：不支持 File System Access API 时使用
// ============================================================

function openFallback(filters?: FileDialogFilter[]): Promise<FileOpenResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.style.display = 'none'
    if (filters) {
      input.accept = filters.flatMap(f => f.extensions.map(e => `.${e}`)).join(',')
    }
    let settled = false
    const done = (result: FileOpenResult | null) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(result)
    }
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { done(null); return }
      const content = await file.text()
      done({ content, filePath: file.name })
    }
    // 用户取消（未选文件）
    const onFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) done(null)
      }, 300)
    }
    window.addEventListener('focus', onFocus, { once: true })
    document.body.appendChild(input)
    input.click()
  })
}

function saveFallback(filters: FileDialogFilter[], content?: string): string | null {
  const ext = filters?.[0]?.extensions?.[0] ?? 'fprg'
  const filename = `flowchart.${ext}`
  if (content) {
    const blob = new Blob([content], { type: 'text/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  return filename
}

// ============================================================
// Web 适配器实现
// ============================================================

export const webFileSystem: PlatformFileSystem = {
  async showOpenDialog(filters?: FileDialogFilter[]) {
    if (!supportsFileSystemAccess()) {
      return openFallback(filters)
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [handle] = await (window as any).showOpenFilePicker({
        types: filters?.map(f => ({
          description: f.name,
          accept: { 'application/octet-stream': f.extensions.map((e: string) => `.${e}`) },
        })),
        multiple: false,
      })
      const file = await handle.getFile()
      const content = await file.text()
      handleMap.set(file.name, handle)
      // 额外存储 fullPath（如果有权限的话），以便跨会话恢复
      return { content, filePath: file.name }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return null
      throw e
    }
  },

  async showSaveDialog(filters?: FileDialogFilter[], content?: string) {
    if (!supportsFileSystemAccess()) {
      return saveFallback(filters ?? [], content)
    }
    try {
      const ext = filters?.[0]?.extensions?.[0] ?? 'fprg'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await (window as any).showSaveFilePicker({
        types: filters?.map(f => ({
          description: f.name,
          accept: { 'application/octet-stream': f.extensions.map((e: string) => `.${e}`) },
        })),
        suggestedName: `flowchart.${ext}`,
      })
      const filePath = handle.name
      handleMap.set(filePath, handle)
      if (content !== undefined) {
        const writable = await handle.createWritable()
        await writable.write(content)
        await writable.close()
      }
      return filePath
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return null
      throw e
    }
  },

  async readFile(filePath: string) {
    const handle = handleMap.get(filePath)
    if (handle) {
      const file = await handle.getFile()
      return file.text()
    }
    throw new Error(
      `No file handle for "${filePath}". Please re-open the file via File → Open.`,
    )
  },

  async writeFile(filePath: string, content: string) {
    const handle = handleMap.get(filePath)
    if (!handle) {
      // 无存储句柄 → 回退到下载
      const blob = new Blob([content], { type: 'text/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filePath || 'flowchart.fprg'
      a.click()
      URL.revokeObjectURL(url)
      return
    }
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
  },

  async loadRecentFiles() {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as RecentEntry[]) : []
    } catch {
      return []
    }
  },

  async saveRecentFiles(list: RecentEntry[]) {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
    } catch (e) {
      console.error('[web-adapter] saveRecentFiles failed:', e)
    }
  },
}
