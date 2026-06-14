// ============================================================
// Shared types — used across components
// ============================================================

export interface ChatMessage {
  role: 'program' | 'user' | 'system'
  text: string
  sourceNodeId?: string
  timestamp?: number
  separator?: 'run-start'
}

export interface VariableEntry {
  name: string
  type: string
  value: unknown
  tag?: 'return' | 'parameter'
}
