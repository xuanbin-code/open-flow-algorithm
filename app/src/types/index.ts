// ============================================================
// Types — 统一类型导出入口
// ============================================================

// 应用层共享类型（控制台消息、变量监控）
export type { ChatMessage, VariableEntry } from './app'

// 平台适配器类型
export type { FileDialogFilter, FileOpenResult, RecentEntry, PlatformFileSystem } from './platform'
