// ============================================================
// useExecution.ts — 执行引擎 composable
//
// 管理流程图解释器的运行、步进、终止，子函数执行可视化，
// 变量监视、控制台对话、执行高亮等所有执行相关逻辑。
// ============================================================

import { ref, computed, nextTick, type Ref, type ComputedRef } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { graphlib, layout as dagreLayout } from '@dagrejs/dagre'
import { useI18n } from 'vue-i18n'
import {
  createInterpreter,
  resolveInput,
  abortExecution,
  type InterpreterEvent,
  type RuntimeState,
} from '../engine/interpreter'
import {
  FlowchartEngine,
  type LayoutParams,
  type FlowNode,
  type FlowEdge,
} from '../engine/flowchartEngine'
import {
  splitDeclareNames,
  type Program,
  type FunctionDef,
} from '../engine/fprgAst'
import type { ChatMessage, VariableEntry } from '../types'
import type { InvocationViewState } from '../components'
import type { UseSoundReturn } from './useSound'
import { pythonBridge, isPythonBackendAvailable, type PythonEvent } from '../platform'

export type ExecutionStatus = 'idle' | 'running' | 'paused' | 'waiting-input' | 'stopped'

const SPEED_DELAYS: Record<string, number> = { slow: 1000, normal: 300, fast: 50 }
const CARD_WIDTH = 440
const CARD_HEIGHT = 420

export interface UseExecutionOptions {
  program: Ref<Program>
  activeFunction: ComputedRef<FunctionDef>
  functionExecutionEnabled: Record<string, boolean>
  nodes: Ref<FlowNode[]>
  edges: Ref<FlowEdge[]>
  LP: LayoutParams
  sound: UseSoundReturn
  showToast: (message: string, type?: 'success' | 'error') => void
  /** Use Python backend for execution (Tauri mode). Default: auto-detect. */
  usePythonBackend?: boolean
}

export function useExecution(options: UseExecutionOptions) {
  const {
    program,
    activeFunction,
    functionExecutionEnabled,
    nodes,
    edges,
    LP,
    sound,
    showToast,
    usePythonBackend,
  } = options
  const { t } = useI18n()

  /** Whether to use the Python backend for execution. */
  const usingPython = usePythonBackend ?? isPythonBackendAvailable()

  // ============================================
  // VueFlow access (internal)
  // ============================================
  const { updateNodeData, setCenter, findNode, findEdge } = useVueFlow()

  // ============================================
  // 执行状态
  // ============================================
  const executionStatus = ref<ExecutionStatus>('idle')
  const executionOutput = ref<string[]>([])
  const executingNodeIds = ref<Set<string>>(new Set())
  const previousNodeId = ref<string | null>(null)
  const previousAnimatedEdgeId = ref<string | null>(null)
  const executionSpeed = ref<'slow' | 'normal' | 'fast'>('normal')

  const isExecuting = computed(() => executionStatus.value !== 'idle' && executionStatus.value !== 'stopped')

  // ============================================
  // 变量监视
  // ============================================
  const varEntries = ref<VariableEntry[]>([])

  /** 从 RuntimeState 同步变量列表到响应式 ref */
  function syncVariables(state: RuntimeState) {
    const tagMap: Record<string, 'return' | 'parameter'> = {}
    for (const stmt of activeFunction.value.body) {
      if (stmt.kind === 'declare' && stmt.tag) {
        for (const n of splitDeclareNames(stmt.name)) {
          tagMap[n] = stmt.tag
        }
      }
    }

    varEntries.value = Object.keys(state.variables).map((name) => ({
      name,
      type: state.variableTypes[name] || '',
      value: state.variables[name],
      tag: tagMap[name],
    }))
  }

  /** 为子函数窗口同步变量列表 */
  function syncSubWindowVariables(state: RuntimeState, funcName: string): VariableEntry[] {
    const funcDef = program.value.functions.find(f => f.name === funcName)
    if (!funcDef) return []

    const tagMap: Record<string, 'return' | 'parameter'> = {}
    for (const stmt of funcDef.body) {
      if (stmt.kind === 'declare' && stmt.tag) {
        for (const n of splitDeclareNames(stmt.name)) {
          tagMap[n] = stmt.tag
        }
      }
    }

    return Object.keys(state.variables).map((name) => ({
      name,
      type: state.variableTypes[name] || '',
      value: state.variables[name],
      tag: tagMap[name],
    }))
  }

  // ============================================
  // 对话消息 / 控制台
  // ============================================
  const chatMessages = ref<ChatMessage[]>([])
  const runCount = ref(0)

  const inputVariableName = computed(() => {
    const stmt = interpreterRuntime?.currentStatement
    if (stmt?.kind === 'input') return stmt.variable
    return ''
  })

  function onInputSubmit(value: string) {
    chatMessages.value = [...chatMessages.value, { role: 'user', text: value, timestamp: Date.now() }]
    inputResolve?.(value)
  }

  function onInputCancel() {
    stopped = true
    inputResolve?.('')
  }

  function clearOutput() {
    executionOutput.value = []
    chatMessages.value = []
    runCount.value = 0
  }

  // ============================================
  // 执行高亮
  // ============================================
  const lastHighlightedIds = ref<Set<string>>(new Set())
  const flashHighlightedId = ref<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function syncExecutionHighlight() {
    const activeSet = executingNodeIds.value
    const prevSet = lastHighlightedIds.value

    for (const node of nodes.value) {
      const shouldBe = activeSet.has(node.id)
      const was = prevSet.has(node.id)
      if (shouldBe && !was) {
        updateNodeData(node.id, { executing: true })
      }
    }

    lastHighlightedIds.value = new Set(activeSet)
  }

  /** 点击输出气泡：高亮对应节点 + 滚动视口 */
  function onHighlightNode(nodeId: string) {
    const targetNode = findNode(nodeId)
    if (!targetNode) return

    if (flashHighlightedId.value && flashHighlightedId.value !== nodeId) {
      updateNodeData(flashHighlightedId.value, { flashHighlight: false })
    }
    if (flashTimer) {
      clearTimeout(flashTimer)
      flashTimer = null
    }

    flashHighlightedId.value = nodeId
    updateNodeData(nodeId, { flashHighlight: true })

    flashTimer = setTimeout(() => {
      if (flashHighlightedId.value === nodeId) {
        updateNodeData(nodeId, { flashHighlight: false })
        flashHighlightedId.value = null
      }
      flashTimer = null
    }, 1800)

    const pos = targetNode.position
    const w = (targetNode as any).dimensions?.width ?? 120
    const h = (targetNode as any).dimensions?.height ?? 50
    setCenter(pos.x + w / 2, pos.y + h / 2, { zoom: 1, duration: 400 })
  }

  function resetEdgeAnimation() {
    for (const edge of edges.value) {
      const reactiveEdge = findEdge(edge.id)
      if (reactiveEdge) reactiveEdge.animated = false
    }
    previousAnimatedEdgeId.value = null
  }

  // ============================================
  // 子函数执行可视化
  // ============================================
  const subEngineCache = new Map<string, FlowchartEngine>()
  const invocations = ref<Record<string, InvocationViewState>>({})
  let executionCallStack: { functionName: string; invocationId: string | null }[] = []
  let invocationCounter = 0

  const callCanvasVisible = computed(() =>
    isExecuting.value && Object.values(invocations.value).some(inv => inv.parentId !== null),
  )

  function layoutCallTree() {
    const invList = Object.values(invocations.value)
    if (invList.length === 0) return

    const g = new graphlib.Graph()
    g.setGraph({ rankdir: 'LR', nodesep: 100, ranksep: 80, marginx: 40, marginy: 40 })
    g.setDefaultEdgeLabel(() => ({}))

    for (const inv of invList) {
      g.setNode(inv.id, { width: CARD_WIDTH, height: CARD_HEIGHT })
    }
    for (const inv of invList) {
      if (inv.parentId && g.hasNode(inv.parentId)) {
        g.setEdge(inv.parentId, inv.id)
      }
    }

    dagreLayout(g)

    for (const inv of invList) {
      const node = g.node(inv.id)
      if (node) {
        inv.position = {
          x: node.x - CARD_WIDTH / 2,
          y: node.y - CARD_HEIGHT / 2,
        }
      }
    }
  }

  function createInvocation(
    functionName: string,
    engineForFunction: FlowchartEngine,
    opts: {
      parentId: string | null
      callSiteNodeId?: string | null
      callExpression?: string
      variables?: VariableEntry[]
    },
  ): InvocationViewState {
    const instanceId = ++invocationCounter
    const id = `${functionName}_${instanceId}`

    return {
      id,
      functionName,
      instanceId,
      parentId: opts.parentId,
      callSiteNodeId: opts.callSiteNodeId ?? null,
      callExpression: opts.callExpression,
      status: 'active',
      nodes: [...engineForFunction.nodes],
      edges: [...engineForFunction.edges],
      executingNodeIds: [],
      previousNodeId: null,
      activeEdgeId: null,
      variables: opts.variables ?? [],
      position: { x: 0, y: 0 },
    }
  }

  function createRootInvocation() {
    const hasEnabledSubFunctions = Object.values(functionExecutionEnabled).some(Boolean)

    if (hasEnabledSubFunctions) {
      const rootEngine = new FlowchartEngine(activeFunction.value, LP, { program: program.value })
      const root = createInvocation('Main', rootEngine, {
        parentId: null,
        variables: [],
      })
      invocations.value = { [root.id]: root }
      executionCallStack = [{ functionName: 'Main', invocationId: root.id }]
    } else {
      invocations.value = {}
      executionCallStack = [{ functionName: 'Main', invocationId: null }]
    }
  }

  function markInvocationCompleted(id: string) {
    const inv = invocations.value[id]
    if (!inv) return
    inv.status = 'completed'
    inv.executingNodeIds = []
    inv.activeEdgeId = null
  }

  function handleInvocationStatementEnter(
    frame: { functionName: string; invocationId: string | null } | undefined,
    nodeId: string,
  ) {
    const invocation = frame?.invocationId ? invocations.value[frame.invocationId] : null
    if (!invocation || !interpreterRuntime) return

    invocation.executingNodeIds = [...invocation.executingNodeIds, nodeId]
    if (invocation.previousNodeId) {
      const edge = invocation.edges.find(
        e => e.source === invocation.previousNodeId && e.target === nodeId,
      )
      invocation.activeEdgeId = edge?.id ?? null
    } else {
      const startNode = invocation.nodes.find(n => n.type === 'start')
      if (startNode) {
        const startEdge = invocation.edges.find(
          e => e.source === startNode.id && e.target === nodeId,
        )
        invocation.activeEdgeId = startEdge?.id ?? null
      } else {
        invocation.activeEdgeId = null
      }
    }
    invocation.previousNodeId = nodeId
    invocation.variables = invocation.functionName === 'Main'
      ? [...varEntries.value]
      : syncSubWindowVariables(interpreterRuntime, invocation.functionName)
  }

  function handleInvocationStatementLeave(
    frame: { functionName: string; invocationId: string | null } | undefined,
    nodeId: string,
  ) {
    const invocation = frame?.invocationId ? invocations.value[frame.invocationId] : null
    if (!invocation || !interpreterRuntime) return

    invocation.executingNodeIds = invocation.executingNodeIds.filter(id => id !== nodeId)

    const endNode = invocation.nodes.find(n => n.type === 'end')
    if (endNode) {
      const endEdge = invocation.edges.find(
        e => e.source === nodeId && e.target === endNode.id,
      )
      invocation.activeEdgeId = endEdge?.id ?? null
    } else {
      invocation.activeEdgeId = null
    }

    invocation.variables = invocation.functionName === 'Main'
      ? [...varEntries.value]
      : syncSubWindowVariables(interpreterRuntime, invocation.functionName)
  }

  function handleMainStatementEnter(
    frame: { functionName: string; invocationId: string | null } | undefined,
    nodeId: string,
  ) {
    if (frame?.functionName !== 'Main') return
    executingNodeIds.value.add(nodeId)
    syncExecutionHighlight()

    if (previousAnimatedEdgeId.value) {
      const prevEdge = findEdge(previousAnimatedEdgeId.value)
      if (prevEdge) prevEdge.animated = false
      previousAnimatedEdgeId.value = null
    }

    if (previousNodeId.value) {
      const edge = edges.value.find(
        e => e.source === previousNodeId.value && e.target === nodeId,
      )
      if (edge) {
        const reactiveEdge = findEdge(edge.id)
        if (reactiveEdge) {
          reactiveEdge.animated = true
          previousAnimatedEdgeId.value = edge.id
        }
      }
    } else {
      const startNode = nodes.value.find(n => n.type === 'start')
      if (startNode) {
        const startEdge = edges.value.find(
          e => e.source === startNode.id && e.target === nodeId,
        )
        if (startEdge) {
          const reactiveEdge = findEdge(startEdge.id)
          if (reactiveEdge) {
            reactiveEdge.animated = true
            previousAnimatedEdgeId.value = startEdge.id
          }
        }
      }
    }
    previousNodeId.value = nodeId
  }

  function handleMainStatementLeave(
    frame: { functionName: string; invocationId: string | null } | undefined,
    nodeId: string,
  ) {
    if (frame?.functionName !== 'Main') return
    executingNodeIds.value.delete(nodeId)
    updateNodeData(nodeId, { executing: false })
    syncExecutionHighlight()

    const endNode = nodes.value.find(n => n.type === 'end')
    if (endNode) {
      const endEdge = edges.value.find(
        e => e.source === nodeId && e.target === endNode.id,
      )
      if (endEdge) {
        if (previousAnimatedEdgeId.value) {
          const prevEdge = findEdge(previousAnimatedEdgeId.value)
          if (prevEdge) prevEdge.animated = false
        }
        const reactiveEdge = findEdge(endEdge.id)
        if (reactiveEdge) {
          reactiveEdge.animated = true
          previousAnimatedEdgeId.value = endEdge.id
        }
      }
    }
  }

  function pushInvocationFrame(event: Extract<InterpreterEvent, { type: 'function-enter' }>) {
    const parentFrame = executionCallStack[executionCallStack.length - 1]
    const parentId = parentFrame?.invocationId ?? null
    let invocationId: string | null = null

    if (functionExecutionEnabled[event.functionName]) {
      const cachedEngine = subEngineCache.get(event.functionName)
      if (cachedEngine && interpreterRuntime) {
        const invocation = createInvocation(event.functionName, cachedEngine, {
          parentId,
          callSiteNodeId: event.callerNodeId ?? null,
          callExpression: event.callExpression,
          variables: syncSubWindowVariables(interpreterRuntime, event.functionName),
        })
        invocationId = invocation.id
        invocations.value = {
          ...invocations.value,
          [invocation.id]: invocation,
        }

        if (parentId && event.callerNodeId) {
          const parentInv = invocations.value[parentId]
          if (parentInv) {
            parentInv.executingNodeIds = parentInv.executingNodeIds.filter(
              id => id !== event.callerNodeId,
            )
          }
        }

        layoutCallTree()
      }
    }

    executionCallStack.push({
      functionName: event.functionName,
      invocationId,
    })
  }

  function popInvocationFrame() {
    const frame = executionCallStack.pop()
    if (!frame?.invocationId || !interpreterRuntime || !invocations.value[frame.invocationId]) return
    invocations.value[frame.invocationId].variables =
      syncSubWindowVariables(interpreterRuntime, frame.functionName)
    markInvocationCompleted(frame.invocationId)
  }

  // ============================================
  // 执行生命周期
  // ============================================

  function resetExecution() {
    executionStatus.value = 'idle'
    executionOutput.value = []
    varEntries.value = []

    const prevSet = lastHighlightedIds.value
    for (const node of nodes.value) {
      if (prevSet.has(node.id)) {
        updateNodeData(node.id, { executing: false })
      }
    }
    executingNodeIds.value.clear()
    lastHighlightedIds.value.clear()

    previousNodeId.value = null
    previousAnimatedEdgeId.value = null
    interpreterRuntime = null
    interpreterGen = null
    stepResolve = null
    inputResolve = null
    stopped = false
    resetEdgeAnimation()

    if (flashHighlightedId.value) {
      updateNodeData(flashHighlightedId.value, { flashHighlight: false })
      flashHighlightedId.value = null
    }
    if (flashTimer) {
      clearTimeout(flashTimer)
      flashTimer = null
    }

    executionCallStack = []
    invocationCounter = 0
    invocations.value = {}
    subEngineCache.clear()
  }

  /** 预构建已勾选的子函数的 FlowchartEngine */
  function preBuildSubEngines() {
    subEngineCache.clear()
    for (const func of program.value.functions) {
      if (func.name !== 'Main' && functionExecutionEnabled[func.name]) {
        subEngineCache.set(
          func.name,
          new FlowchartEngine(func, LP, { program: program.value }),
        )
      }
    }
  }

  // ============================================
  // 解释器引用（非响应式）
  // ============================================
  let interpreterRuntime: RuntimeState | null = null
  let interpreterGen: AsyncGenerator<InterpreterEvent> | null = null
  let stepResolve: (() => void) | null = null
  let inputResolve: ((value: string) => void) | null = null
  let stopped = false

  // ============================================
  // 核心驱动循环
  // ============================================
  async function driveInterpreter(mode: 'run' | 'step') {
    const gen = interpreterGen
    if (!gen || !interpreterRuntime) {
      executionStatus.value = 'idle'
      return
    }

    try {
      while (true) {
        if (stopped) {
          resetEdgeAnimation()
          executionStatus.value = 'stopped'
          return
        }

        const result = await gen.next()
        if (result.done) break

        const event = result.value as InterpreterEvent

        switch (event.type) {
          case 'statement-enter': {
            const topFrame = executionCallStack[executionCallStack.length - 1]
            handleInvocationStatementEnter(topFrame, event.nodeId)
            handleMainStatementEnter(topFrame, event.nodeId)

            syncVariables(interpreterRuntime)
            if (topFrame?.functionName === 'Main' && topFrame.invocationId && invocations.value[topFrame.invocationId]) {
              invocations.value[topFrame.invocationId].variables = [...varEntries.value]
            }
            if (mode === 'step') sound.playTick()
            break
          }
          case 'statement-leave': {
            console.log(`[eventLoop] statement-leave nodeId=${event.nodeId}`)
            const topFrame = executionCallStack[executionCallStack.length - 1]
            handleInvocationStatementLeave(topFrame, event.nodeId)
            handleMainStatementLeave(topFrame, event.nodeId)
            break
          }
          case 'function-enter': {
            pushInvocationFrame(event)
            await nextTick()
            break
          }
          case 'function-leave': {
            popInvocationFrame()
            break
          }
          case 'output': {
            executionOutput.value = [...executionOutput.value, event.text]
            chatMessages.value = [...chatMessages.value, {
              role: 'program',
              text: event.text,
              sourceNodeId: event.nodeId,
              timestamp: Date.now(),
            }]
            break
          }
          case 'input-request': {
            executionStatus.value = 'waiting-input'
            sound.playInputPrompt()
            const value = await new Promise<string>((resolve) => {
              inputResolve = resolve
            })
            if (stopped) {
              resetEdgeAnimation()
              executionStatus.value = 'stopped'
              return
            }
            resolveInput(interpreterRuntime, value)
            inputResolve = null
            executionStatus.value = mode === 'step' ? 'paused' : 'running'
            break
          }
          case 'error': {
            sound.playError()
            executionOutput.value = [...executionOutput.value, t('toasts.errorPrefix', { message: event.message })]
            chatMessages.value = [...chatMessages.value, { role: 'system', text: t('toasts.errorPrefixShort', { message: event.message }), timestamp: Date.now() }]
            resetEdgeAnimation()
            executionStatus.value = 'stopped'
            showToast(t('toasts.execError', { message: event.message }), 'error')
            syncExecutionHighlight()
            return
          }
          case 'done': {
            sound.playDone()
            executionOutput.value = [...executionOutput.value, t('execution.execDoneDivider')]
            chatMessages.value = [...chatMessages.value, { role: 'system', text: t('toasts.execDone'), timestamp: Date.now() }]
            resetEdgeAnimation()
            executionStatus.value = 'idle'
            showToast(t('toasts.execDone'), 'success')
            syncExecutionHighlight()
            return
          }
        }

        if (mode === 'run' && executionStatus.value === 'running') {
          await new Promise<void>((resolve) => setTimeout(resolve, SPEED_DELAYS[executionSpeed.value]))
        }

        if (mode === 'run' && executionStatus.value === 'paused' && !stopped) {
          await new Promise<void>((resolve) => {
            stepResolve = resolve
          })
          stepResolve = null
          if (stopped) {
            resetEdgeAnimation()
            executionStatus.value = 'stopped'
            return
          }
          executionStatus.value = 'running'
        }

        if (mode === 'step' && event.type !== 'statement-leave') {
          executionStatus.value = 'paused'
          syncVariables(interpreterRuntime)
          await new Promise<void>((resolve) => {
            stepResolve = resolve
          })
          stepResolve = null
          if (stopped) {
            resetEdgeAnimation()
            executionStatus.value = 'stopped'
            return
          }
          executionStatus.value = 'running'
        }
      }

      syncVariables(interpreterRuntime)
      executionStatus.value = 'idle'
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      executionOutput.value = [...executionOutput.value, t('toasts.exceptionPrefix', { message: msg })]
      chatMessages.value = [...chatMessages.value, { role: 'system', text: t('toasts.exceptionPrefixShort', { message: msg }), timestamp: Date.now() }]
      resetEdgeAnimation()
      executionStatus.value = 'stopped'
      showToast(t('toasts.execException', { message: msg }), 'error')
      syncExecutionHighlight()
    }
  }

  // ============================================
  // Python 后端驱动循环
  //
  // 替代 driveInterpreter()，通过 JSON-RPC 与 Python 后端通信。
  // 事件处理逻辑与 JS 版本保持一致，确保 UI 行为不变。
  // ============================================

  async function driveInterpreterPython(mode: 'run' | 'step') {
    try {
      while (true) {
        if (stopped) {
          resetEdgeAnimation()
          executionStatus.value = 'stopped'
          return
        }

        // Call Python backend for the next step
        let event: PythonEvent
        try {
          event = await pythonBridge.call('step')
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          executionOutput.value = [...executionOutput.value, t('toasts.exceptionPrefix', { message: msg })]
          chatMessages.value = [...chatMessages.value, { role: 'system', text: t('toasts.exceptionPrefixShort', { message: msg }), timestamp: Date.now() }]
          resetEdgeAnimation()
          executionStatus.value = 'stopped'
          showToast(t('toasts.execException', { message: msg }), 'error')
          syncExecutionHighlight()
          return
        }

        switch (event.event) {
          case 'statement-enter': {
            const topFrame = executionCallStack[executionCallStack.length - 1]
            handleInvocationStatementEnter(topFrame, event.nodeId ?? '')
            handleMainStatementEnter(topFrame, event.nodeId ?? '')

            // Sync variables from Python backend
            try {
              const varResult = await pythonBridge.call('get_variables')
              const vars = varResult.variables ?? []
              varEntries.value = vars.map((v: any) => ({
                name: v.name,
                type: v.type,
                value: v.value,
              }))
            } catch { /* ignore variable sync errors */ }

            if (topFrame?.functionName === 'Main' && topFrame.invocationId && invocations.value[topFrame.invocationId]) {
              invocations.value[topFrame.invocationId].variables = [...varEntries.value]
            }
            if (mode === 'step') sound.playTick()
            break
          }
          case 'statement-leave': {
            const topFrame = executionCallStack[executionCallStack.length - 1]
            handleInvocationStatementLeave(topFrame, event.nodeId ?? '')
            handleMainStatementLeave(topFrame, event.nodeId ?? '')
            break
          }
          case 'function-enter': {
            pushInvocationFramePython(event)
            await nextTick()
            break
          }
          case 'function-leave': {
            popInvocationFrame()
            break
          }
          case 'output': {
            executionOutput.value = [...executionOutput.value, event.text ?? '']
            chatMessages.value = [...chatMessages.value, {
              role: 'program',
              text: event.text ?? '',
              sourceNodeId: event.nodeId,
              timestamp: Date.now(),
            }]
            break
          }
          case 'input-request': {
            executionStatus.value = 'waiting-input'
            sound.playInputPrompt()
            const value = await new Promise<string>((resolve) => {
              inputResolve = resolve
            })
            if (stopped) {
              resetEdgeAnimation()
              executionStatus.value = 'stopped'
              return
            }
            // Send input to Python backend
            try {
              await pythonBridge.call('set_input', { value })
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e)
              executionOutput.value = [...executionOutput.value, t('toasts.exceptionPrefix', { message: msg })]
              chatMessages.value = [...chatMessages.value, { role: 'system', text: t('toasts.exceptionPrefixShort', { message: msg }), timestamp: Date.now() }]
              resetEdgeAnimation()
              executionStatus.value = 'stopped'
              showToast(t('toasts.execException', { message: msg }), 'error')
              return
            }
            inputResolve = null
            executionStatus.value = mode === 'step' ? 'paused' : 'running'
            break
          }
          case 'error': {
            sound.playError()
            const errorMsg = event.message ?? 'Unknown error'
            executionOutput.value = [...executionOutput.value, t('toasts.errorPrefix', { message: errorMsg })]
            chatMessages.value = [...chatMessages.value, { role: 'system', text: t('toasts.errorPrefixShort', { message: errorMsg }), timestamp: Date.now() }]
            resetEdgeAnimation()
            executionStatus.value = 'stopped'
            showToast(t('toasts.execError', { message: errorMsg }), 'error')
            syncExecutionHighlight()
            return
          }
          case 'done': {
            sound.playDone()
            executionOutput.value = [...executionOutput.value, t('execution.execDoneDivider')]
            chatMessages.value = [...chatMessages.value, { role: 'system', text: t('toasts.execDone'), timestamp: Date.now() }]
            resetEdgeAnimation()
            executionStatus.value = 'idle'
            showToast(t('toasts.execDone'), 'success')
            syncExecutionHighlight()
            return
          }
        }

        if (mode === 'run' && executionStatus.value === 'running') {
          await new Promise<void>((resolve) => setTimeout(resolve, SPEED_DELAYS[executionSpeed.value]))
        }

        if (mode === 'run' && executionStatus.value === 'paused' && !stopped) {
          await new Promise<void>((resolve) => {
            stepResolve = resolve
          })
          stepResolve = null
          if (stopped) {
            resetEdgeAnimation()
            executionStatus.value = 'stopped'
            return
          }
          executionStatus.value = 'running'
        }

        if (mode === 'step' && event.event !== 'statement-leave') {
          executionStatus.value = 'paused'
          // Sync variables on pause
          try {
            const varResult = await pythonBridge.call('get_variables')
            const vars = varResult.variables ?? []
            varEntries.value = vars.map((v: any) => ({
              name: v.name,
              type: v.type,
              value: v.value,
            }))
          } catch { /* ignore */ }
          await new Promise<void>((resolve) => {
            stepResolve = resolve
          })
          stepResolve = null
          if (stopped) {
            resetEdgeAnimation()
            executionStatus.value = 'stopped'
            return
          }
          executionStatus.value = 'running'
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      executionOutput.value = [...executionOutput.value, t('toasts.exceptionPrefix', { message: msg })]
      chatMessages.value = [...chatMessages.value, { role: 'system', text: t('toasts.exceptionPrefixShort', { message: msg }), timestamp: Date.now() }]
      resetEdgeAnimation()
      executionStatus.value = 'stopped'
      showToast(t('toasts.execException', { message: msg }), 'error')
      syncExecutionHighlight()
    }
  }

  /** Python-backend version of pushInvocationFrame. */
  function pushInvocationFramePython(event: PythonEvent) {
    const parentFrame = executionCallStack[executionCallStack.length - 1]
    const parentId = parentFrame?.invocationId ?? null
    let invocationId: string | null = null

    if (event.functionName && functionExecutionEnabled[event.functionName]) {
      const cachedEngine = subEngineCache.get(event.functionName)
      if (cachedEngine) {
        // Sync variables for the new frame from Python backend
        pythonBridge.call('get_variables').then(varResult => {
          const vars = (varResult.variables ?? []).map((v: any) => ({
            name: v.name,
            type: v.type,
            value: v.value,
          }))
          const invocation = createInvocation(event.functionName!, cachedEngine, {
            parentId,
            callSiteNodeId: event.callerNodeId ?? null,
            callExpression: event.callExpression,
            variables: vars,
          })
          invocationId = invocation.id
          invocations.value = {
            ...invocations.value,
            [invocation.id]: invocation,
          }

          if (parentId && event.callerNodeId) {
            const parentInv = invocations.value[parentId]
            if (parentInv) {
              parentInv.executingNodeIds = parentInv.executingNodeIds.filter(
                id => id !== event.callerNodeId,
              )
            }
          }

          layoutCallTree()
        })
      }
    }

    executionCallStack.push({
      functionName: event.functionName ?? '',
      invocationId,
    })
  }

  // ============================================
  // 执行控制
  // ============================================

  async function startExecution() {
    if (isExecuting.value) return

    resetExecution()

    preBuildSubEngines()
    createRootInvocation()

    if (chatMessages.value.length > 0) {
      runCount.value++
      chatMessages.value = [...chatMessages.value, {
        role: 'system',
        text: `—— ${t('execution.runDivider')} #${runCount.value} ——`,
        timestamp: Date.now(),
        separator: 'run-start',
      }]
    }

    executionStatus.value = 'running'

    if (usingPython) {
      // Python backend path
      try {
        const ast = JSON.parse(JSON.stringify(program.value)) // deep clone AST
        await pythonBridge.call('load_program', { ast })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        showToast(t('toasts.execException', { message: msg }), 'error')
        executionStatus.value = 'stopped'
        return
      }
      sound.playStart()
      await driveInterpreterPython('run')
    } else {
      // JavaScript interpreter path (original)
      const { state, generator } = createInterpreter(program.value, functionExecutionEnabled)
      interpreterRuntime = state
      interpreterGen = generator

      sound.playStart()
      await driveInterpreter('run')
    }
  }

  async function stepExecution() {
    if (executionStatus.value === 'idle' || executionStatus.value === 'stopped') {
      resetExecution()

      preBuildSubEngines()
      createRootInvocation()

      if (chatMessages.value.length > 0) {
        runCount.value++
        chatMessages.value = [...chatMessages.value, {
          role: 'system',
          text: `—— ${t('execution.runDivider')} #${runCount.value} ——`,
          timestamp: Date.now(),
          separator: 'run-start',
        }]
      }

      executionStatus.value = 'running'

      if (usingPython) {
        try {
          const ast = JSON.parse(JSON.stringify(program.value))
          await pythonBridge.call('load_program', { ast })
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          showToast(t('toasts.execException', { message: msg }), 'error')
          executionStatus.value = 'stopped'
          return
        }
        sound.playStart()
        await driveInterpreterPython('step')
      } else {
        const { state, generator } = createInterpreter(program.value, functionExecutionEnabled)
        interpreterRuntime = state
        interpreterGen = generator

        sound.playStart()
        await driveInterpreter('step')
      }
    } else if (executionStatus.value === 'paused') {
      executionStatus.value = 'running'
      stepResolve?.()
    }
  }

  function stopExecution() {
    if (executionStatus.value === 'idle' || executionStatus.value === 'stopped') return
    stopped = true

    if (executionStatus.value === 'waiting-input' && inputResolve) {
      inputResolve('')
    }
    if (executionStatus.value === 'paused' && stepResolve) {
      stepResolve()
    }
    if (interpreterRuntime) {
      abortExecution(interpreterRuntime)
    }
    // Stop Python backend execution if active
    if (usingPython) {
      pythonBridge.call('stop').catch(() => { /* ignore */ })
    }

    const prevSet = lastHighlightedIds.value
    for (const node of nodes.value) {
      if (prevSet.has(node.id)) {
        updateNodeData(node.id, { executing: false })
      }
    }
    executingNodeIds.value.clear()
    lastHighlightedIds.value.clear()
    resetEdgeAnimation()

    sound.playStop()
    executionStatus.value = 'stopped'
    showToast(t('toasts.execTerminated'), 'error')
  }

  function pauseExecution() {
    if (executionStatus.value !== 'running') return
    executionStatus.value = 'paused'
  }

  function resumeExecution() {
    if (executionStatus.value !== 'paused') return
    executionStatus.value = 'running'
    stepResolve?.()
  }

  function setExecutionSpeed(speed: 'slow' | 'normal' | 'fast') {
    executionSpeed.value = speed
    const labels: Record<string, string> = { slow: t('menu.speedSlow'), normal: t('menu.speedNormal'), fast: t('menu.speedFast') }
    showToast(t('toasts.speedChanged', { speed: labels[speed] }), 'success')
  }

  // ============================================
  // 导出
  // ============================================

  return {
    // Execution status
    executionStatus,
    executionOutput,
    executionSpeed,
    isExecuting,

    // Highlighting
    executingNodeIds,
    flashHighlightedId,
    onHighlightNode,
    resetEdgeAnimation,

    // Variables
    varEntries,

    // Chat / console
    chatMessages,
    runCount,
    inputVariableName,
    onInputSubmit,
    onInputCancel,
    clearOutput,

    // Sub-function visualization
    invocations,
    callCanvasVisible,
    createRootInvocation,

    // Execution control
    startExecution,
    stepExecution,
    stopExecution,
    pauseExecution,
    resumeExecution,
    setExecutionSpeed,

    // Lifecycle helpers
    resetExecution,
    preBuildSubEngines,
  }
}
