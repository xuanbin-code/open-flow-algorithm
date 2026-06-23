// ============================================================
// Python Backend Bridge — Tauri IPC wrapper
//
// Communicates with the Python backend subprocess via Tauri commands.
// The Rust backend manages process lifecycle and JSON-RPC communication.
//
// Available only in Tauri mode. In web mode, the old JS interpreter
// is used as a fallback.
// ============================================================

import { invoke } from '@tauri-apps/api/core'

/**
 * Event structure returned by the Python interpreter.
 * Matches the existing InterpreterEvent type from the JS interpreter
 * to maintain compatibility with UI components.
 */
export interface PythonEvent {
  event: 'statement-enter' | 'statement-leave' | 'output'
    | 'input-request' | 'function-enter' | 'function-leave'
    | 'error' | 'done'
  nodeId?: string
  statement?: string
  text?: string
  variable?: string
  functionName?: string
  callerNodeId?: string
  callExpression?: string
  message?: string
  traceback?: string
  variables?: Array<{ name: string; type: string; value: unknown }>
  status?: string
  functions?: string[]
  events?: PythonEvent[]
  sourceCode?: string
  warnings?: Array<{ severity: string; message: string }>
  isValid?: boolean
}

/**
 * Singleton bridge to the Python backend.
 *
 * Usage:
 *   await pythonBridge.start()
 *   const event = await pythonBridge.call('step')
 *   await pythonBridge.stop()
 */
class PythonBridge {
  private _started = false
  private _startPromise: Promise<void> | null = null

  /**
   * Start the Python backend subprocess.
   * Idempotent — safe to call multiple times.
   */
  async start(): Promise<void> {
    if (this._started) return

    // Prevent concurrent start attempts
    if (this._startPromise) {
      return this._startPromise
    }

    this._startPromise = (async () => {
      try {
        const result = await invoke<boolean>('start_python_backend')
        if (result) {
          this._started = true
          console.log('[pythonBridge] Python backend started successfully')
        } else {
          console.warn('[pythonBridge] Python backend start returned false')
        }
      } catch (e) {
        this._startPromise = null
        throw new Error(`Failed to start Python backend: ${e}`)
      }
    })()

    return this._startPromise
  }

  /**
   * Send a JSON-RPC command to the Python backend.
   *
   * Automatically starts the backend if not already running.
   *
   * @param method - The RPC method name (load_program, step, run, etc.)
   * @param params - Optional parameters for the method
   * @returns The response result from the Python backend
   */
  async call(method: string, params?: Record<string, unknown>): Promise<PythonEvent> {
    if (!this._started) {
      await this.start()
    }

    try {
      const result = await invoke<PythonEvent>('send_python_command', {
        method,
        params: params ?? null,
      })
      return result
    } catch (e) {
      // If the backend died, mark as not started and re-throw
      const msg = String(e)
      if (msg.includes('not running') || msg.includes('connection')) {
        this._started = false
        this._startPromise = null
      }
      throw e
    }
  }

  /**
   * Gracefully shut down the Python backend.
   */
  async stop(): Promise<void> {
    if (!this._started) return

    try {
      await invoke('stop_python_backend')
    } catch (e) {
      console.warn('[pythonBridge] Error stopping Python backend:', e)
    } finally {
      this._started = false
      this._startPromise = null
    }
  }

  /**
   * Check if the Python backend is alive.
   */
  async isAlive(): Promise<boolean> {
    if (!this._started) return false
    try {
      return await invoke<boolean>('python_backend_status')
    } catch {
      return false
    }
  }

  /** Whether the bridge has been started. */
  get isStarted(): boolean {
    return this._started
  }
}

/** Singleton instance */
export const pythonBridge = new PythonBridge()

/**
 * Check if the Python backend is available (Tauri mode only).
 */
export function isPythonBackendAvailable(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI__' in window || '__TAURI_INTERNALS__' in window
}

/**
 * Export a program AST as Python source code.
 *
 * Calls the Python backend's export_python method and returns the
 * generated source code string.
 */
export async function exportToPython(ast: Record<string, unknown>): Promise<string> {
  const result = await pythonBridge.call('export_python', { ast })
  return result.sourceCode ?? ''
}

/**
 * Validate a program AST for security issues.
 */
export async function validateAst(ast: Record<string, unknown>): Promise<{
  warnings: Array<{ severity: string; message: string }>
  isValid: boolean
}> {
  const result = await pythonBridge.call('validate_ast', { ast })
  return {
    warnings: result.warnings ?? [],
    isValid: result.isValid ?? true,
  }
}

/**
 * Parse Python source code into a Flowgorithm program AST.
 *
 * Calls the Python backend's parse_python_code method.
 * Available only in Tauri mode (requires Python backend).
 *
 * @param code - Python source code string
 * @returns The Program AST object
 */
export async function parsePythonCode(code: string): Promise<Record<string, unknown>> {
  const result = await pythonBridge.call('parse_python_code', { code })
  if (!result || !(result as any).ast) {
    throw new Error('Python backend returned no AST')
  }
  return (result as any).ast
}
