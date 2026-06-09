<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue'
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
import ExecutionPanel from './components/panels/ExecutionPanel.vue'
import type { VariableEntry } from './components/panels/ExecutionPanel.vue'
import InputDialog from './components/panels/InputDialog.vue'
import MenuBar from './components/MenuBar.vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

import { parseFprgToAst, astToFprgXml, createEmptyProgram, findStatementLocation, type Program, type Statement } from './fprg-ast'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { addRecentFile, loadRecentFiles, getLastFile, type RecentEntry } from './recent-files'
import {
  FlowchartEngine,
  DEFAULT_PARAMS,
  PARAM_DEFS,
  type LayoutParams,
  type FlowNode,
  type FlowEdge,
} from './flowchart-engine'
import { createInterpreter, resolveInput, abortExecution, type InterpreterEvent, type RuntimeState } from './interpreter'

// ============================================
// 布局参数（可实时调试）
// ============================================
const LP = reactive<LayoutParams>({ ...DEFAULT_PARAMS })

// ============================================
// Program & Engine
// ============================================

// 先用空白 Program 初始化，onMounted 中尝试恢复上次文件
const program = ref<Program>(createEmptyProgram())
let engine = new FlowchartEngine(program.value, LP)

const programHistory = useRefHistory(program, {
  deep: true,
  capacity: 50,
})

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
const executingNodeId = ref<string | null>(null)
const executionSpeed = ref<'slow' | 'normal' | 'fast'>('normal')
const SPEED_DELAYS: Record<string, number> = { slow: 1000, normal: 300, fast: 50 }

/** 是否正在执行中（禁用编辑操作） */
const isExecuting = computed(() => executionStatus.value !== 'idle')

/** 变量列表（响应式，从 RuntimeState 同步） */
const varEntries = ref<VariableEntry[]>([])

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
  varEntries.value = Object.keys(state.variables).map((name) => ({
    name,
    type: state.variableTypes[name] || '',
    value: state.variables[name],
  }))
}

/** 加载 fprg XML → 重建 engine + 更新 VueFlow 响应式数据 */
function loadProgram(xml: string, filePath?: string) {
  program.value = parseFprgToAst(xml)
  engine = new FlowchartEngine(program.value, LP)
  nodes.value = [...engine.nodes]
  edges.value = [...engine.edges]
  if (filePath) {
    currentFilePath.value = filePath
    isNewFile.value = false
  }
  console.log('Loaded program:', program.value.attributes.name, filePath ? `(${filePath})` : '')
}

// 绑定到 VueFlow
const nodes = ref<FlowNode[]>(engine.nodes)
const edges = ref<FlowEdge[]>(engine.edges)

// 布局参数热更新：监听 LP 变化 → 重新排版
let layoutTimer: ReturnType<typeof setTimeout> | null = null
watch(LP, () => {
  if (layoutTimer) clearTimeout(layoutTimer)
  layoutTimer = setTimeout(() => {
    engine.layout()
    // 触发 Vue 响应式：engine 绕过 Proxy 修改了原始对象，需手动通知
    nodes.value = [...engine.nodes]
    console.log('Re-layout done, node count:', nodes.value.length)
  }, 30)
})

const { fitView } = useVueFlow()

// ============================================
// 启动：尝试恢复上次文件
// ============================================

async function initApp() {
  const lastFile = await getLastFile()

  if (lastFile) {
    try {
      const xml = await readTextFile(lastFile)
      loadProgram(xml, lastFile)
      await refreshRecentFiles()
      console.log('已恢复上次文件:', lastFile)
      return
    } catch {
      console.warn('上次文件无法打开，回退到空白画布:', lastFile)
    }
  }

  // 文件不存在 / 首次启动 → 空白画布
  program.value = createEmptyProgram()
  engine = new FlowchartEngine(program.value, LP)
  nodes.value = [...engine.nodes]
  edges.value = [...engine.edges]
  currentFilePath.value = null
  isNewFile.value = true
  await refreshRecentFiles()
  console.log('空白画布已创建')
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

function undo() {
  programHistory.undo()
  engine = new FlowchartEngine(program.value, LP)
  nodes.value = [...engine.nodes]
  edges.value = [...engine.edges]
  syncSelectionState()
}

function redo() {
  programHistory.redo()
  engine = new FlowchartEngine(program.value, LP)
  nodes.value = [...engine.nodes]
  edges.value = [...engine.edges]
  syncSelectionState()
}

/** 同步 selectedNodeId → nodes 数组中对应节点的 selected 属性 */
function syncSelectionState() {
  for (const node of nodes.value) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(node as any).selected = node.id === selectedNodeId.value
  }
}

/** 同步 executingNodeId → nodes 数组中对应节点的 executing 属性 */
function syncExecutionHighlight() {
  for (const node of nodes.value) {
    node.data.executing = node.id === executingNodeId.value
  }
  // 触发 VueFlow 重渲染
  nodes.value = [...nodes.value]
}

// ============================================
// 执行控制函数
// ============================================

function resetExecution() {
  executionStatus.value = 'idle'
  executionOutput.value = []
  varEntries.value = []
  executingNodeId.value = null
  interpreterRuntime = null
  interpreterGen = null
  stepResolve = null
  inputResolve = null
  stopped = false
  syncExecutionHighlight()
}

async function startExecution() {
  if (isExecuting.value) return

  resetExecution()
  executionStatus.value = 'running'

  const { state, generator } = createInterpreter(program.value)
  interpreterRuntime = state
  interpreterGen = generator

  await driveInterpreter('run')
}

async function stepExecution() {
  if (executionStatus.value === 'idle') {
    // 首次步进：初始化解释器
    resetExecution()

    const { state, generator } = createInterpreter(program.value)
    interpreterRuntime = state
    interpreterGen = generator

    executionStatus.value = 'running'
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

  executionStatus.value = 'stopped'
  showToast('执行已终止', 'error')
}

function setExecutionSpeed(speed: 'slow' | 'normal' | 'fast') {
  executionSpeed.value = speed
  const labels = { slow: '慢速', normal: '正常', fast: '快速' }
  showToast(`运行速度：${labels[speed]}`, 'success')
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
        executionStatus.value = 'stopped'
        return
      }

      const result = await gen.next()
      if (result.done) break

      const event = result.value as InterpreterEvent

      switch (event.type) {
        case 'statement-enter': {
          executingNodeId.value = event.nodeId
          syncExecutionHighlight()
          syncVariables(interpreterRuntime)
          break
        }
        case 'statement-leave': {
          // 离开循环节点时不清除高亮（body 执行期间保持高亮）
          break
        }
        case 'output': {
          executionOutput.value = [...executionOutput.value, event.text]
          break
        }
        case 'input-request': {
          executionStatus.value = 'waiting-input'
          // 等待外部 resolve
          const value = await new Promise<string>((resolve) => {
            inputResolve = resolve
          })
          if (stopped) {
            executionStatus.value = 'stopped'
            return
          }
          resolveInput(interpreterRuntime, value)
          inputResolve = null
          executionStatus.value = mode === 'step' ? 'paused' : 'running'
          break
        }
        case 'error': {
          executionOutput.value = [...executionOutput.value, `[错误] ${event.message}`]
          executionStatus.value = 'stopped'
          showToast(`运行错误: ${event.message}`, 'error')
          syncExecutionHighlight()
          return
        }
        case 'done': {
          executionOutput.value = [...executionOutput.value, '—— 程序执行完毕 ——']
          executionStatus.value = 'idle'
          showToast('程序执行完毕', 'success')
          syncExecutionHighlight()
          return
        }
      }

      // Run 模式：语句间延迟
      if (mode === 'run' && executionStatus.value === 'running') {
        await new Promise<void>((resolve) => setTimeout(resolve, SPEED_DELAYS[executionSpeed.value]))
      }

      // Step 模式：暂停等待下一次步进
      if (mode === 'step') {
        executionStatus.value = 'paused'
        syncVariables(interpreterRuntime)
        await new Promise<void>((resolve) => {
          stepResolve = resolve
        })
        stepResolve = null
        if (stopped) {
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
    executionOutput.value = [...executionOutput.value, `[异常] ${msg}`]
    executionStatus.value = 'stopped'
    showToast(`运行异常: ${msg}`, 'error')
    syncExecutionHighlight()
  }
}

function onInputSubmit(value: string) {
  inputResolve?.(value)
}

function onInputCancel() {
  stopped = true
  inputResolve?.('')
}

function clearOutput() {
  executionOutput.value = []
}

onMounted(async () => {
  await initApp()
  setTimeout(() => fitView(), 100)
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
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
  const loc = findStatementLocation(program.value, stmt)
  if (loc) {
    loc.body.splice(loc.index, 1)
  }
  selectedNodeId.value = null
  engine.rebuild()
  nodes.value = [...engine.nodes]
  edges.value = [...engine.edges]
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
  engine.rebuild()
  nodes.value = [...engine.nodes]
  edges.value = [...engine.edges]
  // 重建后恢复选中状态
  syncSelectionState()
}

function onCloseEditor() {
  editingStatement.value = null
  panelVisible.value = false
  selectedNodeId.value = null
  // 最后一次重建确保最终状态
  engine.rebuild()
  nodes.value = [...engine.nodes]
  edges.value = [...engine.edges]
}

// ============================================
// 菜单栏事件
// ============================================

async function onMenuAction(actionId: string) {
  // 处理「打开最近文件」点击
  if (actionId.startsWith('open-recent:')) {
    const filePath = actionId.slice('open-recent:'.length)
    try {
      const xml = await readTextFile(filePath)
      loadProgram(xml, filePath)
      await addRecentFile(filePath)
      await refreshRecentFiles()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast(`无法打开文件: ${msg}`, 'error')
    }
    return
  }

  switch (actionId) {
    case 'new': {
      program.value = createEmptyProgram()
      engine = new FlowchartEngine(program.value, LP)
      nodes.value = [...engine.nodes]
      edges.value = [...engine.edges]
      currentFilePath.value = null
      isNewFile.value = true
      setTimeout(() => fitView(), 100)
      break
    }
    case 'open': {
      const selected = await open({
        filters: [{ name: 'Flowgorithm 文件', extensions: ['fprg'] }],
        multiple: false,
      })
      if (selected) {
        const xml = await readTextFile(selected as string)
        loadProgram(xml, selected as string)
        await addRecentFile(selected as string)
        await refreshRecentFiles()
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
    default:
      console.log(`Menu action: ${actionId} (未实现)`)
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
    await writeTextFile(currentFilePath.value, xml)
    // 重新读取验证
    const verifyXml = await readTextFile(currentFilePath.value)
    loadProgram(verifyXml, currentFilePath.value)
    await addRecentFile(currentFilePath.value)
    await refreshRecentFiles()
    showToast('保存成功', 'success')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[保存失败]', e)
    showToast(`保存失败: ${msg}`, 'error')
  }
}

/** 另存为新文件 */
async function handleSaveAs() {
  try {
    const savePath = await save({
      filters: [{ name: 'Flowgorithm 文件', extensions: ['fprg'] }],
    })
    if (savePath) {
      const xml = astToFprgXml(program.value)
      await writeTextFile(savePath as string, xml)
      currentFilePath.value = savePath as string
      isNewFile.value = false
      const verifyXml = await readTextFile(savePath as string)
      loadProgram(verifyXml, currentFilePath.value)
      await addRecentFile(savePath as string)
      await refreshRecentFiles()
      showToast('另存成功', 'success')
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[另存失败]', e)
    showToast(`另存失败: ${msg}`, 'error')
  }
}
</script>

<template>
  <div class="flowchart-sandbox">
    <MenuBar :recent-files="recentFiles" :execution-status="executionStatus" @action="onMenuAction" />
    <div class="flow-container">
      <VueFlow
        :nodes="nodes"
        :edges="edges"
        :default-viewport="{ zoom: 1, x: 50, y: 20 }"
        :min-zoom="0.1"
        :max-zoom="4"
        fit-view-on-init
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
      </VueFlow>
    </div>
    <LayoutDebugPanel :params="LP" :definitions="PARAM_DEFS" />
    <ExecutionPanel
      :output="executionOutput"
      :variables="varEntries"
      :visible="true"
      :execution-status="executionStatus"
      @clear="clearOutput"
    />
    <InsertNodePanel
      v-if="panelVisible"
      :position="panelPosition"
      :editing-statement="editingStatement"
      @close="panelVisible = false; editingStatement = null"
      @insert="onInsertNode"
      @update-property="onUpdateProperty"
      @close-editor="onCloseEditor"
    />
    <InputDialog
      :visible="executionStatus === 'waiting-input'"
      :variable-name="inputVariableName"
      @submit="onInputSubmit"
      @cancel="onInputCancel"
    />
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
  background: #1a1a2e;
}
.flow-container {
  flex: 1;
  width: 100%;
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
  stroke: #4fc3f7;
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
  background: #27ae60;
}
.toast.error {
  background: #e74c3c;
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
  background: #7f8c8d;
  border: 2px solid #6c7a7a;
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
</style>
