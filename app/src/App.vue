<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRefHistory } from '@vueuse/core'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import StartNode from './components/nodes/StartNode.vue'
import EndNode from './components/nodes/EndNode.vue'
import DeclareNode from './components/nodes/DeclareNode.vue'
import AssignNode from './components/nodes/AssignNode.vue'
import InputNode from './components/nodes/InputNode.vue'
import OutputNode from './components/nodes/OutputNode.vue'
import IfNode from './components/nodes/IfNode.vue'
import MergeNode from './components/nodes/MergeNode.vue'
import ForNode from './components/nodes/ForNode.vue'
import WhileNode from './components/nodes/WhileNode.vue'
import InsertNodePanel from './components/panels/InsertNodePanel.vue'
import LayoutDebugPanel from './components/panels/LayoutDebugPanel.vue'
import ExecutionConsole from './components/panels/ExecutionConsole.vue'
import type { ChatMessage } from './components/panels/ExecutionConsole.vue'
import VariableMonitor from './components/panels/VariableMonitor.vue'
import type { VariableEntry } from './components/panels/VariableMonitor.vue'

import SettingsDialog from './components/SettingsDialog.vue'
import FunctionTabBar from './components/FunctionTabBar.vue'
import FunctionDialog from './components/FunctionDialog.vue'
import CallNode from './components/nodes/CallNode.vue'
import MenuBar from './components/MenuBar.vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'

import { parseFprgToAst, astToFprgXml, createEmptyProgram, findStatementLocation, getFunctionByName, addFunction, deleteFunction, renameFunction, splitDeclareNames, type Program, type Statement, type FunctionDef, type DeclareStatement } from './engine/fprg-ast'
import { showOpenDialog, showSaveDialog, readFile, writeFile, loadRecentFiles, addRecentFile, getLastFile, type RecentEntry } from '@/platform'
import {
  FlowchartEngine,
  DEFAULT_PARAMS,
  PARAM_DEFS,
  type LayoutParams,
  type FlowNode,
  type FlowEdge,
} from './engine/flowchart-engine'
import { createInterpreter, resolveInput, abortExecution, type InterpreterEvent, type RuntimeState } from './engine/interpreter'
import { useSettings } from './composables/useSettings'
import { useViewportFit } from './composables/useViewportFit'
import { useSound } from './composables/useSound'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const sound = useSound()

// ============================================
// 布局参数（可实时调试）
// ============================================
const LP = reactive<LayoutParams>({ ...DEFAULT_PARAMS })

// ============================================
// Program & Engine
// ============================================

// 先用空白 Program 初始化，onMounted 中尝试恢复上次文件
const program = ref<Program>(createEmptyProgram())

// 函数管理状态
const activeFunctionName = ref<string>('Main')
const showFunctionDialog = ref(false)
const editingFunction = ref<FunctionDef | null>(null)

/** 获取当前活动函数定义 */
const activeFunction = computed(() =>
  getFunctionByName(program.value, activeFunctionName.value) ?? program.value.functions[0],
)

let engine = new FlowchartEngine(activeFunction.value, LP, { program: program.value })

const programHistory = useRefHistory(program, {
  deep: true,
  capacity: 50,
})

/** 是否有未保存的修改（undo 栈非空表示自上次保存后有变更） */
const isDirty = computed(() => programHistory.undoStack.value.length > 0)

/** 当前打开的文件路径（null 表示尚未关联文件） */
const currentFilePath = ref<string | null>(null)

/** 是否为新建空白文件（保存时走另存为） */
const isNewFile = ref(false)

/** 最近打开的文件列表 */
const recentFiles = ref<RecentEntry[]>([])

// ============================================
// 执行状态（流程图解释器）
// ============================================

type ExecutionStatus = 'idle' | 'running' | 'paused' | 'waiting-input' | 'stopped'
const executionStatus = ref<ExecutionStatus>('idle')
const executionOutput = ref<string[]>([])
/** 执行节点栈（Set）：支持嵌套语句（if/while/for）与内部语句同时高亮 */
const executingNodeIds = ref<Set<string>>(new Set())
const previousNodeId = ref<string | null>(null)
const executionSpeed = ref<'slow' | 'normal' | 'fast'>('normal')
const SPEED_DELAYS: Record<string, number> = { slow: 1000, normal: 300, fast: 50 }

/** 视图参数（仅影响视口，不触发 re-layout） */
const vpZoom = ref(1)
const vpX = ref(50)
const vpY = ref(20)

// 视图参数变化 → 仅调整视口
watch([vpZoom, vpX, vpY], () => {
  setViewport({ zoom: vpZoom.value, x: vpX.value, y: vpY.value })
})

/** 是否正在执行中（禁用编辑操作） */
const isExecuting = computed(() => executionStatus.value !== 'idle' && executionStatus.value !== 'stopped')

/** 变量列表（响应式，从 RuntimeState 同步） */
const varEntries = ref<VariableEntry[]>([])

/** 变量监视面板是否可见 */
const showVariableMonitor = ref(true)

/** 对话消息列表（程序输出 + 用户输入） */
const chatMessages = ref<ChatMessage[]>([])
const runCount = ref(0)

// Interpreter 引用（非响应式）
let interpreterRuntime: RuntimeState | null = null
let interpreterGen: AsyncGenerator<InterpreterEvent> | null = null

/** 当前输入变量名（用于 InputDialog 显示） */
const inputVariableName = computed(() => {
  const stmt = interpreterRuntime?.currentStatement
  if (stmt?.kind === 'input') return stmt.variable
  return ''
})
let stepResolve: (() => void) | null = null
let inputResolve: ((value: string) => void) | null = null
let stopped = false

/** 从 RuntimeState 同步变量列表到响应式 ref */
function syncVariables(state: RuntimeState) {
  // 从活动函数的 declare 语句中提取变量 tag 信息
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

/** 根据活动函数重建流程图引擎 */
function rebuildEngine() {
  engine = new FlowchartEngine(activeFunction.value, LP, { program: program.value })
  nodes.value = [...engine.nodes]
  edges.value = [...engine.edges]
  syncSelectionState()
}

/** 加载 fprg XML → 重建 engine + 更新 VueFlow 响应式数据 */
function loadProgram(xml: string, filePath?: string) {
  program.value = parseFprgToAst(xml)
  activeFunctionName.value = 'Main'
  engine = new FlowchartEngine(activeFunction.value, LP, { program: program.value })
  nodes.value = [...engine.nodes]
  edges.value = [...engine.edges]
  if (filePath) {
    currentFilePath.value = filePath
    isNewFile.value = false
  }
  // 推迟到下一微任务：等 Vue pre-flush watcher 记录完旧值后再清空历史
  Promise.resolve().then(() => programHistory.clear())
  console.log('Loaded program:', program.value.attributes.name, filePath ? `(${filePath})` : '')
}

// 绑定到 VueFlow — 初始为空数组，待 onMounted 中 initApp 完成后再赋值（防止 Start+End 闪烁）
const nodes = ref<FlowNode[]>([])
const edges = ref<FlowEdge[]>([])
const isContentReady = ref(false)

// 布局参数热更新：监听 LP 变化 → 重新排版
let layoutTimer: ReturnType<typeof setTimeout> | null = null
watch(LP, () => {
  if (layoutTimer) clearTimeout(layoutTimer)
  layoutTimer = setTimeout(() => {
    engine = new FlowchartEngine(activeFunction.value, LP, { program: program.value })
    nodes.value = [...engine.nodes]
    console.log('Re-layout done, node count:', nodes.value.length)
  }, 30)
})

const { setViewport, updateNodeData, setCenter, findNode } = useVueFlow()

// 视口定位：使用固定缩放比例将 Start 节点居中在视图中
const { settings } = useSettings() // 提前捕获 settings（原在 line 722 的独立调用）
const { fitToStartNode, getContainerRect } = useViewportFit(nodes)
const containerRect = ref<DOMRect | null>(null)

async function doFitToStartNode() {
  containerRect.value = getContainerRect()
  await fitToStartNode({
    zoom: settings.value.defaultZoom,
    yOffset: settings.value.yOffset,
  })
  // 同步 vpZoom/vpX/vpY 到调试面板滑块（静默更新，不触发 watcher 的 setViewport 重复调用）
  // 直接用 setViewport 的结果不经过 vp* watcher，所以手动同步
  const actualZoom = settings.value.defaultZoom
  vpZoom.value = actualZoom
}

// ============================================
// 启动：尝试恢复上次文件
// ============================================

async function initApp() {
  const lastFile = await getLastFile()

  if (lastFile) {
    try {
      const xml = await readFile(lastFile)
      loadProgram(xml, lastFile)
      await refreshRecentFiles()
      console.log('[initApp] restored last file:', lastFile)
      return
    } catch {
      console.warn('[initApp] cannot open last file, fallback to blank:', lastFile)
    }
  }

  // 文件不存在 / 首次启动 → 空白画布
  program.value = createEmptyProgram()
  activeFunctionName.value = 'Main'
  engine = new FlowchartEngine(activeFunction.value, LP, { program: program.value })
  nodes.value = [...engine.nodes]
  edges.value = [...engine.edges]
  currentFilePath.value = null
  isNewFile.value = true
  // 推迟到下一微任务：等 Vue pre-flush watcher 记录完旧值后再清空历史
  Promise.resolve().then(() => programHistory.clear())
  await refreshRecentFiles()
  console.log('[initApp] blank canvas created')
}

async function refreshRecentFiles() {
  try {
    recentFiles.value = await loadRecentFiles()
  } catch {
    recentFiles.value = []
  }
}

// CTRL+S / Ctrl+Z / Ctrl+Y / Delete 快捷键
function onKeydown(e: KeyboardEvent) {
  // 焦点在输入框中 → 交给浏览器处理原生快捷键（如 Ctrl+Z 文本撤销）
  const ae = document.activeElement
  if (
    ae &&
    (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' ||
     (ae as HTMLElement).isContentEditable)
  ) {
    return
  }

  // 运行时不响应编辑快捷键（Ctrl+S 除外：运行中不允许保存）
  if (isExecuting.value) {
    // 仍允许 Ctrl+S 保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      return // 静默忽略
    }
    return
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    handleSave()
  }
  // Ctrl+Z → 撤销
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
    e.preventDefault()
    undo()
  }
  // Ctrl+Y (或 Ctrl+Shift+Z) → 重做
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
    e.preventDefault()
    redo()
  }
  if (e.key === 'Delete' && selectedNodeId.value) {
    e.preventDefault()
    deleteSelectedNode()
  }
}

/** 语言切换时重建引擎以更新节点标签 */
function onLanguageChanged() {
  rebuildEngine()
}

function undo() {
  programHistory.undo()
  rebuildEngine()
}

function redo() {
  programHistory.redo()
  rebuildEngine()
}

/** 同步 selectedNodeId → nodes 数组中对应节点的 selected 属性 */
function syncSelectionState() {
  for (const node of nodes.value) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(node as any).selected = node.id === selectedNodeId.value
  }
}

/** 记录上一次高亮的节点 ID 集合，用于增量更新 */
const lastHighlightedIds = ref<Set<string>>(new Set())

/** 当前 flash 高亮的节点 ID（点击输出气泡触发，同一时间只有一个） */
const flashHighlightedId = ref<string | null>(null)
/** flash 高亮自动清除定时器 */
let flashTimer: ReturnType<typeof setTimeout> | null = null

/** 同步 executingNodeIds Set → 节点 data.executing（增量更新，避免全量 setNodes 污染 VueFlow 内部状态）
 *  使用 lastHighlightedIds 对比避免重复调用 updateNodeData（重复调用会导致 CSS animation 重启造成闪烁）
 *  节点取消高亮由 statement-leave 事件处理程序中显式调用 updateNodeData 保证可靠性 */
function syncExecutionHighlight() {
  const activeSet = executingNodeIds.value
  const prevSet = lastHighlightedIds.value

  for (const node of nodes.value) {
    const shouldBe = activeSet.has(node.id)
    const was = prevSet.has(node.id)
    if (shouldBe && !was) {
      updateNodeData(node.id, { executing: true })
    }
    // 注意：取消高亮不在 syncExecutionHighlight 中处理
    // 由 statement-leave 事件处理程序显式调用 updateNodeData(..., false)
    // 避免因 lastHighlightedIds 与实际状态漂移导致高亮残留
  }

  lastHighlightedIds.value = new Set(activeSet)
}

// ============================================
// 执行控制函数
// ============================================

/** 点击输出气泡：高亮对应节点 + 滚动视口 */
function onHighlightNode(nodeId: string) {
  const targetNode = findNode(nodeId)
  if (!targetNode) return

  // 清除上一个 flash 高亮（处理快速点击）
  if (flashHighlightedId.value && flashHighlightedId.value !== nodeId) {
    updateNodeData(flashHighlightedId.value, { flashHighlight: false })
  }
  if (flashTimer) {
    clearTimeout(flashTimer)
    flashTimer = null
  }

  // 应用 flash 高亮
  flashHighlightedId.value = nodeId
  updateNodeData(nodeId, { flashHighlight: true })

  // 1.8s 后自动清除
  flashTimer = setTimeout(() => {
    if (flashHighlightedId.value === nodeId) {
      updateNodeData(nodeId, { flashHighlight: false })
      flashHighlightedId.value = null
    }
    flashTimer = null
  }, 1800)

  // 滚动视口到目标节点
  const pos = targetNode.position
  const w = (targetNode as any).dimensions?.width ?? 120
  const h = (targetNode as any).dimensions?.height ?? 50
  setCenter(pos.x + w / 2, pos.y + h / 2, { zoom: 1, duration: 400 })
}

function resetEdgeAnimation() {
  for (const edge of edges.value) {
    edge.animated = false
  }
}

function resetExecution() {
  executionStatus.value = 'idle'
  executionOutput.value = []
  varEntries.value = []

  // 基于旧 lastHighlightedIds 显式取消所有高亮，避免 clear 后节点 data.executing 残留
  const prevSet = lastHighlightedIds.value
  for (const node of nodes.value) {
    if (prevSet.has(node.id)) {
      updateNodeData(node.id, { executing: false })
    }
  }
  executingNodeIds.value.clear()
  lastHighlightedIds.value.clear()

  previousNodeId.value = null
  interpreterRuntime = null
  interpreterGen = null
  stepResolve = null
  inputResolve = null
  stopped = false
  resetEdgeAnimation()

  // 清理 flash 高亮
  if (flashHighlightedId.value) {
    updateNodeData(flashHighlightedId.value, { flashHighlight: false })
    flashHighlightedId.value = null
  }
  if (flashTimer) {
    clearTimeout(flashTimer)
    flashTimer = null
  }
}

async function startExecution() {
  if (isExecuting.value) return

  resetExecution()

  // 插入运行分隔线
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

  const { state, generator } = createInterpreter(program.value)
  interpreterRuntime = state
  interpreterGen = generator

  sound.playStart()
  await driveInterpreter('run')
}

async function stepExecution() {
  if (executionStatus.value === 'idle' || executionStatus.value === 'stopped') {
    // 首次步进（或终止后重新步进）：初始化解释器
    resetExecution()

    // 插入运行分隔线
    if (chatMessages.value.length > 0) {
      runCount.value++
      chatMessages.value = [...chatMessages.value, {
        role: 'system',
        text: `—— ${t('execution.runDivider')} #${runCount.value} ——`,
        timestamp: Date.now(),
        separator: 'run-start',
      }]
    }

    const { state, generator } = createInterpreter(program.value)
    interpreterRuntime = state
    interpreterGen = generator

    executionStatus.value = 'running'
    sound.playStart()
    await driveInterpreter('step')
  } else if (executionStatus.value === 'paused') {
    // 继续步进
    executionStatus.value = 'running'
    stepResolve?.()
  }
}

function stopExecution() {
  if (executionStatus.value === 'idle' || executionStatus.value === 'stopped') return
  stopped = true

  // 如果正在等待输入，取消等待
  if (executionStatus.value === 'waiting-input' && inputResolve) {
    inputResolve('')
  }
  // 如果已暂停，恢复以便 generator 能检测到 stopped
  if (executionStatus.value === 'paused' && stepResolve) {
    stepResolve()
  }
  // 终止解释器
  if (interpreterRuntime) {
    abortExecution(interpreterRuntime)
  }

  // 清除执行高亮
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

/** 核心驱动循环：逐条消费 generator 事件 */
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
          executingNodeIds.value.add(event.nodeId)
          syncExecutionHighlight()

          // 动画化从上一节点到当前节点的边
          if (previousNodeId.value) {
            const edge = edges.value.find(
              e => e.source === previousNodeId.value && e.target === event.nodeId,
            )
            if (edge) {
              console.log('animating edge', edge)
              edge.animated = true
            }
          }
          previousNodeId.value = event.nodeId

          syncVariables(interpreterRuntime)
          if (mode === 'step') sound.playTick()
          break
        }
        case 'statement-leave': {
          console.log(`[eventLoop] statement-leave nodeId=${event.nodeId}`)
          executingNodeIds.value.delete(event.nodeId)
          // 显式取消高亮：直接调用 updateNodeData 而非依赖 syncExecutionHighlight 的 lastHighlightedIds 对比
          // 避免 lastHighlightedIds 与 VueFlow 内部状态漂移导致节点样式残留
          updateNodeData(event.nodeId, { executing: false })
          syncExecutionHighlight()
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
          // 等待外部 resolve
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

      // Run 模式：语句间延迟
      if (mode === 'run' && executionStatus.value === 'running') {
        await new Promise<void>((resolve) => setTimeout(resolve, SPEED_DELAYS[executionSpeed.value]))
      }

      // 检查是否在 run 模式中被暂停了
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

      // Step 模式：暂停等待下一次步进（跳过 statement-leave，避免在节点间连接线处多停一步）
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

    // Generator 正常结束
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

onMounted(async () => {
  await initApp()
  isContentReady.value = true
  await nextTick()
  await doFitToStartNode()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('language-changed', onLanguageChanged)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('language-changed', onLanguageChanged)
})

// ============================================
// Toast 消息
// ============================================

interface ToastState { message: string; type: 'success' | 'error'; visible: boolean }
const toast = reactive<ToastState>({ message: '', type: 'success', visible: false })
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.message = message
  toast.type = type
  toast.visible = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.visible = false }, 3000)
}

// ============================================
// 设置对话框
// ============================================

const showSettingsDialog = ref(false)

// ============================================
// 节点插入面板
// ============================================
const panelVisible = ref(false)
const panelPosition = ref({ x: 0, y: 0 })
const clickedEdgeId = ref<string | null>(null)
const editingStatement = ref<Statement | null>(null)
const selectedNodeId = ref<string | null>(null)
watch(selectedNodeId, () => syncSelectionState())

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onEdgeClick(data: any) {
  if (isExecuting.value) return
  clickedEdgeId.value = data.edge.id
  panelPosition.value = { x: data.event.clientX + 24, y: data.event.clientY - 120 }
  panelVisible.value = true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onNodeClick(data: any) {
  if (isExecuting.value) return
  // 单击 → 选中节点
  selectedNodeId.value = data.node?.id ?? null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onNodeDblClick(data: any) {
  if (isExecuting.value) return
  // 双击 → 打开属性编辑面板
  const stmt: Statement | undefined = data.node?.data?.statement
  if (!stmt) return  // Start/End/Merge 节点无 statement
  selectedNodeId.value = data.node?.id ?? null
  clickedEdgeId.value = null
  editingStatement.value = stmt
  panelPosition.value = {
    x: data.event.clientX + 24,
    y: data.event.clientY - 120,
  }
  panelVisible.value = true
}

function onPaneClick() {
  if (isExecuting.value) return
  // 点击画布空白 → 取消选中
  selectedNodeId.value = null
}

function deleteSelectedNode() {
  if (isExecuting.value) return
  const nodeId = selectedNodeId.value
  if (!nodeId) return
  const node = engine.nodesMap.get(nodeId)
  if (!node?.data?.statement) return  // Start/End/Merge 不可删除

  const stmt = node.data.statement

  // 带 tag 标记的声明节点不可删除（返回值变量 / 形参）
  if (stmt.kind === 'declare' && (stmt as DeclareStatement).tag) {
    return
  }

  const loc = findStatementLocation(program.value, stmt)
  if (loc) {
    loc.body.splice(loc.index, 1)
  }
  selectedNodeId.value = null
  engine.rebuild()
  nodes.value = [...engine.nodes]
  edges.value = [...engine.edges]
}

// ============================================
// 函数管理
// ============================================

async function onSwitchFunction(name: string) {
  if (isExecuting.value) return
  activeFunctionName.value = name
  rebuildEngine()
  await nextTick()
  await doFitToStartNode()
}

function onAddFunction() {
  editingFunction.value = null
  showFunctionDialog.value = true
}

function onSaveFunction(funcDef: FunctionDef) {
  if (editingFunction.value) {
    // 编辑已有函数
    const oldName = editingFunction.value.name
    if (funcDef.name !== oldName) {
      if (!renameFunction(program.value, oldName, funcDef.name)) return
    }
    // 更新其他属性
    const existing = getFunctionByName(program.value, funcDef.name)
    if (existing) {
      existing.type = funcDef.type
      existing.variable = funcDef.variable
      existing.parameters = funcDef.parameters
    }
  } else {
    // 新建函数：自动生成带 tag 标记的 declare 语句
    const autoDeclares: Statement[] = []

    // 返回值变量（tag: return，不可删除）
    if (funcDef.type !== 'None' && funcDef.variable) {
      autoDeclares.push({
        kind: 'declare',
        name: funcDef.variable,
        type: funcDef.type,
        array: false,
        size: '',
        expression: '',
        tag: 'return',
      })
    }

    // 形参变量（tag: parameter）
    for (const p of funcDef.parameters) {
      autoDeclares.push({
        kind: 'declare',
        name: p.name,
        type: p.type,
        array: p.array,
        size: '',
        expression: '',
        tag: 'parameter',
      })
    }

    // 将自动生成的声明前置到函数体开头
    funcDef.body = [...autoDeclares, ...funcDef.body]

    addFunction(program.value, funcDef)
    activeFunctionName.value = funcDef.name
  }
  showFunctionDialog.value = false
  editingFunction.value = null
  rebuildEngine()
}

function onRenameFunction(oldName: string, newName: string) {
  if (renameFunction(program.value, oldName, newName)) {
    if (activeFunctionName.value === oldName) {
      activeFunctionName.value = newName
    }
    rebuildEngine()
  }
}

function onDeleteFunction(name: string) {
  if (!deleteFunction(program.value, name)) return
  if (activeFunctionName.value === name) {
    activeFunctionName.value = 'Main'
  }
  rebuildEngine()
}

function onInsertNode(type: string) {
  if (clickedEdgeId.value) {
    const newStmt = engine.insertNodeAtEdge(clickedEdgeId.value, type as Statement['kind'])
    nodes.value = [...engine.nodes]
    edges.value = [...engine.edges]
    if (newStmt) {
      editingStatement.value = newStmt
      // 保持 panel 打开，切换为编辑模式
    }
    console.log(`Inserted "${type}" at edge ${clickedEdgeId.value}, nodes: ${nodes.value.length}`)
  }
}

function onUpdateProperty(_stmt: Statement) {
  if (isExecuting.value) return
  // AST statement 已直接修改，重建引擎以更新节点标签和布局
  rebuildEngine()
}

function onCloseEditor() {
  editingStatement.value = null
  panelVisible.value = false
  selectedNodeId.value = null
  // 最后一次重建确保最终状态
  rebuildEngine()
}

// ============================================
// 菜单栏事件
// ============================================

async function onMenuAction(actionId: string) {
  // 处理「打开最近文件」点击
  if (actionId.startsWith('open-recent:')) {
    const filePath = actionId.slice('open-recent:'.length)
    try {
      const xml = await readFile(filePath)
      loadProgram(xml, filePath)
      await addRecentFile(filePath)
      await refreshRecentFiles()
      await nextTick()
      await doFitToStartNode()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast(t('toasts.cannotOpenFile', { message: msg }), 'error')
    }
    return
  }

  switch (actionId) {
    case 'new': {
      program.value = createEmptyProgram()
      activeFunctionName.value = 'Main'
      engine = new FlowchartEngine(activeFunction.value, LP, { program: program.value })
      nodes.value = [...engine.nodes]
      edges.value = [...engine.edges]
      currentFilePath.value = null
      isNewFile.value = true
      // 推迟到下一微任务：等 Vue pre-flush watcher 记录完旧值后再清空历史
      Promise.resolve().then(() => programHistory.clear())
      await nextTick()
      await doFitToStartNode()
      break
    }
    case 'open': {
      const result = await showOpenDialog([
        { name: t('fileDialog.flowgorithmFile'), extensions: ['fprg'] },
      ])
      if (result) {
        loadProgram(result.content, result.filePath)
        await addRecentFile(result.filePath)
        await refreshRecentFiles()
        await nextTick()
        await doFitToStartNode()
      }
      break
    }
    case 'save': {
      await handleSave()
      break
    }
    case 'saveAs': {
      await handleSaveAs()
      break
    }
    case 'undo': {
      undo()
      break
    }
    case 'redo': {
      redo()
      break
    }
    case 'run': {
      startExecution()
      break
    }
    case 'step': {
      stepExecution()
      break
    }
    case 'stop': {
      stopExecution()
      break
    }
    case 'speed-slow': {
      setExecutionSpeed('slow')
      break
    }
    case 'speed-normal': {
      setExecutionSpeed('normal')
      break
    }
    case 'speed-fast': {
      setExecutionSpeed('fast')
      break
    }
    case 'open-settings': {
      showSettingsDialog.value = true
      break
    }
    case 'manage-functions': {
      onAddFunction()
      break
    }
    default:
      console.log(`Menu action: ${actionId} (not implemented)`)
  }
}

/** 保存到当前文件（新建文件或无路径则走另存为） */
async function handleSave() {
  if (isNewFile.value || !currentFilePath.value) {
    await handleSaveAs()
    return
  }
  try {
    const xml = astToFprgXml(program.value)
    await writeFile(currentFilePath.value, xml)
    // 重新读取验证
    const verifyXml = await readFile(currentFilePath.value)
    const savedActiveFunction = activeFunctionName.value
    loadProgram(verifyXml, currentFilePath.value)
    activeFunctionName.value = savedActiveFunction
    rebuildEngine()
    await addRecentFile(currentFilePath.value)
    await refreshRecentFiles()
    showToast(t('toasts.saveSuccess'), 'success')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[save failed]', e)
    showToast(t('toasts.saveFailed', { message: msg }), 'error')
  }
}

/** 另存为新文件 */
async function handleSaveAs() {
  try {
    const xml = astToFprgXml(program.value)
    const savePath = await showSaveDialog(
      [{ name: t('fileDialog.flowgorithmFile'), extensions: ['fprg'] }],
      xml,
    )
    if (savePath) {
      currentFilePath.value = savePath
      isNewFile.value = false
      const verifyXml = await readFile(savePath)
      const savedActiveFunction = activeFunctionName.value
      loadProgram(verifyXml, currentFilePath.value)
      activeFunctionName.value = savedActiveFunction
      rebuildEngine()
      await addRecentFile(savePath)
      await refreshRecentFiles()
      showToast(t('toasts.saveAsSuccess'), 'success')
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[save-as failed]', e)
    showToast(t('toasts.saveAsFailed', { message: msg }), 'error')
  }
}
</script>

<template>
  <div class="flowchart-sandbox">
    <MenuBar
      :recent-files="recentFiles"
      :current-file-path="currentFilePath"
      :is-new-file="isNewFile"
      :is-dirty="isDirty"
      :execution-status="executionStatus"
      :execution-speed="executionSpeed"
      :show-variable-monitor="showVariableMonitor"
      @action="onMenuAction"
      @run="startExecution"
      @step="stepExecution"
      @pause="pauseExecution"
      @resume="resumeExecution"
      @stop="stopExecution"
      @set-speed="setExecutionSpeed"
      @toggle-variable-monitor="showVariableMonitor = !showVariableMonitor"
    />
    <div class="main-area">
      <FunctionTabBar
        :functions="program.functions"
        :active-function="activeFunctionName"
        @switch-function="onSwitchFunction"
        @add-function="onAddFunction"
        @rename-function="onRenameFunction"
        @delete-function="onDeleteFunction"
      />
      <div class="flow-container" :class="{ 'flow-ready': isContentReady }">
        <VueFlow
          :key="activeFunctionName"
          :nodes="nodes"
          :edges="edges"
          :default-viewport="{ zoom: 1, x: 50, y: 20 }"
          :min-zoom="0.1"
          :max-zoom="4"
          @edge-click="onEdgeClick"
          @node-click="onNodeClick"
          @node-double-click="onNodeDblClick"
          @pane-click="onPaneClick"
        >
          <Background pattern-color="#aaa" :gap="20" />
          <Controls />
          <template #node-start="nodeProps"
            ><StartNode v-bind="nodeProps"
          /></template>
          <template #node-end="nodeProps"
            ><EndNode v-bind="nodeProps"
          /></template>
          <template #node-default="nodeProps"
            ><div class="default-node-fallback" :class="{ 'is-empty': nodeProps.data?.isEmpty }" :style="{ width: (nodeProps.data?.width ?? 120) + 'px', height: (nodeProps.data?.height ?? 50) + 'px' }">{{ nodeProps.data?.label ?? '' }}</div
          /></template>
          <template #node-declare="nodeProps"
            ><DeclareNode v-bind="nodeProps"
          /></template>
          <template #node-assign="nodeProps"
            ><AssignNode v-bind="nodeProps"
          /></template>
          <template #node-fg-input="nodeProps"
            ><InputNode v-bind="nodeProps"
          /></template>
          <template #node-fg-output="nodeProps"
            ><OutputNode v-bind="nodeProps"
          /></template>
          <template #node-fg-if="nodeProps"
            ><IfNode v-bind="nodeProps"
          /></template>
          <template #node-fg-merge="nodeProps"
            ><MergeNode v-bind="nodeProps"
          /></template>
          <template #node-fg-for="nodeProps"
            ><ForNode v-bind="nodeProps"
          /></template>
          <template #node-fg-while="nodeProps"
            ><WhileNode v-bind="nodeProps"
          /></template>
          <template #node-call="nodeProps"
            ><CallNode v-bind="nodeProps"
          /></template>
        </VueFlow>
      </div>
      <ExecutionConsole
        class="execution-console"
        :chat-messages="chatMessages"
        :variables="varEntries"
        :execution-status="executionStatus"
        :variable-name="inputVariableName"
        @clear="clearOutput"
        @submit-input="onInputSubmit"
        @cancel-input="onInputCancel"
        @highlight-node="onHighlightNode"
      />
    </div>
    <VariableMonitor
      :variables="varEntries"
      :visible="showVariableMonitor"
      @close="showVariableMonitor = false"
    />
    <LayoutDebugPanel
      :params="LP"
      :definitions="PARAM_DEFS"
      v-model:vp-zoom="vpZoom"
      v-model:vp-x="vpX"
      v-model:vp-y="vpY"
      :default-zoom="settings.defaultZoom"
      :y-offset="settings.yOffset"
      :container-rect="containerRect"
      @update:default-zoom="(val: number) => settings.defaultZoom = val"
      @update:y-offset="(val: number) => settings.yOffset = val"
      @fit-to-start="doFitToStartNode()"
    />
    <InsertNodePanel
      v-if="panelVisible"
      :position="panelPosition"
      :editing-statement="editingStatement"
      :all-functions="program.functions"
      @close="panelVisible = false; editingStatement = null"
      @insert="onInsertNode"
      @update-property="onUpdateProperty"
      @close-editor="onCloseEditor"
    />
    <FunctionDialog
      :visible="showFunctionDialog"
      :function="editingFunction"
      :existing-names="program.functions.map(f => f.name)"
      @close="showFunctionDialog = false; editingFunction = null"
      @save="onSaveFunction"
    />
    <SettingsDialog :visible="showSettingsDialog" @close="showSettingsDialog = false" />
    <!-- Toast 消息 -->
    <Transition name="toast-fade">
      <div v-if="toast.visible" class="toast" :class="toast.type">{{ toast.message }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.flowchart-sandbox {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 10%, transparent), transparent 30%),
    var(--bg-app);
  color: var(--text-primary);
}
.main-area {
  flex: 1;
  display: flex;
  gap: 10px;
  overflow: hidden;
  padding: 10px;
}
.flow-container {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  opacity: 0;
  transition: opacity 0.15s ease;
  background: var(--bg-canvas);
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  box-shadow: var(--shadow-canvas);
}
.flow-container.flow-ready {
  opacity: 1;
}
.execution-console {
  width: 400px;
  height: 100%;
  flex-shrink: 0;
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: var(--shadow-panel-soft);
}
</style>

<style>
/* 连接线基础样式 */
.vue-flow__edge-path {
  stroke-width: 2px;
  transition: stroke 0.2s ease;
}

/* hover 效果：仅改变 stroke 颜色，避免 CSS filter 触发 Chromium SVG 合成层闪烁 */
.vue-flow__edge:hover .vue-flow__edge-path {
  stroke: var(--accent);
}

/* 连接线箭头填充 */
.vue-flow__arrowclosed path {
  fill: var(--vf-pattern-color);
}

/* ---- Toast ---- */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 10000;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}
.toast.success {
  background: var(--accent-green);
}
.toast.error {
  background: var(--accent-red);
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

/* ---- 默认节点回退样式 ---- */
.default-node-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  background: var(--node-fallback-bg);
  border: 2px solid var(--node-fallback-border);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 8px;
}

.default-node-fallback.is-empty {
  opacity: 0.6;
  filter: grayscale(0.7);
}

/* ---- 深色模式：VueFlow 缩放控件 ---- */
:root:not([data-theme="light"]) .vue-flow__controls-button {
  background: var(--bg-panel);
  border: 1px solid var(--border-soft);
  color: var(--text-secondary);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

:root:not([data-theme="light"]) .vue-flow__controls-button:hover {
  background: var(--bg-hover-strong);
  color: var(--text-primary);
}

:root:not([data-theme="light"]) .vue-flow__controls-button path {
  fill: var(--text-secondary);
}

:root:not([data-theme="light"]) .vue-flow__controls-button:hover path {
  fill: var(--text-primary);
}
</style>
