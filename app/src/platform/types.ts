// ============================================================
// 平台适配器 — 共享类型定义
// ============================================================

export interface FileDialogFilter {
  name: string
  extensions: string[]
}

export interface FileOpenResult {
  content: string
  filePath: string
}

export interface RecentEntry {
  path: string
  name: string
  openedAt: string
}

export interface PlatformFileSystem {
  /** 打开文件对话框 + 读取文件内容 */
  showOpenDialog(filters?: FileDialogFilter[]): Promise<FileOpenResult | null>

  /** 保存文件对话框 + 写入内容 */
  showSaveDialog(filters?: FileDialogFilter[], content?: string): Promise<string | null>

  /** 读取指定路径的文件内容 */
  readFile(filePath: string): Promise<string>

  /** 写入内容到指定路径 */
  writeFile(filePath: string, content: string): Promise<void>

  /** 加载最近打开文件列表 */
  loadRecentFiles(): Promise<RecentEntry[]>

  /** 保存最近打开文件列表 */
  saveRecentFiles(list: RecentEntry[]): Promise<void>
}
