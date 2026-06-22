// ============================================================
// useProgram.ts — 程序状态、引擎管理、文件 I/O、撤销重做 Composables
//
// 管理流程图程序的核心状态：AST、引擎、布局参数、文件路径、历史记录。
// 这是所有其他 composables 的基础依赖。
// ============================================================

import { ref, reactive, watch, computed, type Ref, type ComputedRef } from 'vue'
import { useRefHistory } from '@vueuse/core'
import { useVueFlow } from '@vue-flow/core'
import { nextTick } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useRecentFilesStore } from '../stores/recentFiles'
import { useViewportFit } from './useViewportFit'
import {
  parseFprgToAst,
  astToFprgXml,
  createEmptyProgram,
  getFunctionByName,
  type Program,
  type FunctionDef,
} from '../engine/fprgAst'
import {
  FlowchartEngine,
  DEFAULT_PARAMS,
  type LayoutParams,
  type FlowNode,
  type FlowEdge,
} from '../engine/flowchartEngine'
import { showOpenDialog, showSaveDialog, readFile, writeFile, getLastFile } from '../platform'
import { useI18n } from 'vue-i18n'

export interface UseProgramOptions {
  /** Toast 通知回调（注入以解耦 useToast） */
  showToast: (message: string, type?: 'success' | 'error') => void
  /** 可写的回调 ref：在加载/新建程序前调用（用于 resetExecution）。
   *  由 App.vue 在 useExecution 创建后注入。 */
  onBeforeLoad?: Ref<(() => void) | null>
}

export interface UseProgramReturn {
  // Core state
  program: Ref<Program>
  engine: Ref<FlowchartEngine>
  nodes: Ref<FlowNode[]>
  edges: Ref<FlowEdge[]>
  LP: LayoutParams
  activeFunctionName: Ref<string>
  activeFunction: ComputedRef<FunctionDef>
  isContentReady: Ref<boolean>
  // File state
  currentFilePath: Ref<string | null>
  isNewFile: Ref<boolean>
  fileLoadVersion: Ref<number>
  recentFilesStore: ReturnType<typeof useRecentFilesStore>
  // Undo/redo
  isDirty: ComputedRef<boolean>
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  // Function execution toggles
  functionExecutionEnabled: Record<string, boolean>
  // Selection
  selectedNodeId: Ref<string | null>
  // Viewport
  vpZoom: Ref<number>
  vpX: Ref<number>
  vpY: Ref<number>
  containerRect: Ref<DOMRect | null>
  // Methods
  rebuildEngine: () => void
  loadProgram: (xml: string, filePath?: string) => void
  resetToEmpty: () => void
  undo: () => void
  redo: () => void
  handleOpen: () => Promise<void>
  handleSave: () => Promise<void>
  handleSaveAs: () => Promise<void>
  initApp: () => Promise<void>
  refreshRecentFiles: () => Promise<void>
  doFitToStartNode: () => Promise<void>
  syncSelectionState: () => void
  onLanguageChanged: () => void
}

export function useProgram(options: UseProgramOptions): UseProgramReturn {
  const { showToast, onBeforeLoad } = options
  const { t } = useI18n()

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

  /** 获取当前活动函数定义 */
  const activeFunction = computed(() =>
    getFunctionByName(program.value, activeFunctionName.value) ?? program.value.functions[0],
  )

  const engine = ref<FlowchartEngine>(new FlowchartEngine(activeFunction.value, LP, { program: program.value }))

  const programHistory = useRefHistory(program, {
    deep: true,
    capacity: 50,
  })

  /** 是否有未保存的修改（undo 栈非空表示自上次保存后有变更） */
  const isDirty = computed(() => programHistory.undoStack.value.length > 0)

  /** 是否有可撤销的操作 */
  const canUndo = computed(() => programHistory.undoStack.value.length > 0)

  /** 是否有可重做的操作 */
  const canRedo = computed(() => programHistory.redoStack.value.length > 0)

  /** 当前打开的文件路径（null 表示尚未关联文件） */
  const currentFilePath = ref<string | null>(null)

  /** 是否为新建空白文件（保存时走另存为） */
  const isNewFile = ref(false)

  /** 最近打开的文件列表（Pinia store） */
  const recentFilesStore = useRecentFilesStore()

  // 子函数执行可视化
  const functionExecutionEnabled = reactive<Record<string, boolean>>({})
  const fileLoadVersion = ref(0) // 每次 loadProgram 递增，强制 FunctionTabBar 重建

  /** 视图参数（仅影响视口，不触发 re-layout） */
  function resetFunctionExecutionToggles(enableSubFunctions = true) {
    for (const key of Object.keys(functionExecutionEnabled)) {
      delete functionExecutionEnabled[key]
    }
    for (const func of program.value.functions) {
      if (func.name !== 'Main') {
        functionExecutionEnabled[func.name] = enableSubFunctions
      }
    }
  }

  const vpZoom = ref(1)
  const vpX = ref(50)
  const vpY = ref(20)

  // ============================================
  // VueFlow 绑定
  // ============================================
  const nodes = ref<FlowNode[]>([])
  const edges = ref<FlowEdge[]>([])
  const isContentReady = ref(false)

  const { setViewport } = useVueFlow()
  const settingsStore = useSettingsStore()
  const { fitToStartNode, getContainerRect } = useViewportFit(nodes)
  const containerRect = ref<DOMRect | null>(null)

  // ============================================
  // 节点选中状态
  // ============================================
  const selectedNodeId = ref<string | null>(null)

  /** 同步 selectedNodeId → nodes 数组中对应节点的 selected 属性 */
  function syncSelectionState() {
    for (const node of nodes.value) {
      ;(node as any).selected = node.id === selectedNodeId.value
    }
  }
  watch(selectedNodeId, () => syncSelectionState())

  // ============================================
  // Engine 管理
  // ============================================

  /** 根据活动函数重建流程图引擎 */
  function rebuildEngine() {
    engine.value = new FlowchartEngine(activeFunction.value, LP, { program: program.value })
    nodes.value = [...engine.value.nodes]
    edges.value = [...engine.value.edges]
    syncSelectionState()
  }

  /** 视图参数变化 → 仅调整视口 */
  watch([vpZoom, vpX, vpY], () => {
    setViewport({ zoom: vpZoom.value, x: vpX.value, y: vpY.value })
  })

  // 布局参数热更新：监听 LP 变化 → 重新排版
  let layoutTimer: ReturnType<typeof setTimeout> | null = null
  watch(LP, () => {
    if (layoutTimer) clearTimeout(layoutTimer)
    layoutTimer = setTimeout(() => {
      engine.value = new FlowchartEngine(activeFunction.value, LP, { program: program.value })
      nodes.value = [...engine.value.nodes]
      console.log('Re-layout done, node count:', nodes.value.length)
    }, 30)
  })

  // 当 program 被整体替换时（undo/redo、loadProgram 等），自动重建 engine
  // 确保 engine.funcDef 始终与 program.value 中的函数对象一致
  watch(program, () => {
    rebuildEngine()
  })

  /** 加载 fprg XML → 重建 engine + 更新 VueFlow 响应式数据 */
  function loadProgram(xml: string, filePath?: string) {
    // 清理执行状态（来自 useExecution 的 resetExecution）
    onBeforeLoad?.value?.()
    // 清理上一个文件的执行可视化标记
    program.value = parseFprgToAst(xml)
    resetFunctionExecutionToggles(true)
    activeFunctionName.value = 'Main'
    engine.value = new FlowchartEngine(activeFunction.value, LP, { program: program.value })
    nodes.value = [...engine.value.nodes]
    edges.value = [...engine.value.edges]
    if (filePath) {
      currentFilePath.value = filePath
      isNewFile.value = false
    }
    // 递增版本号，强制 FunctionTabBar 重建以刷新函数列表
    fileLoadVersion.value++
    // 推迟到下一微任务：等 Vue pre-flush watcher 记录完旧值后再清空历史
    Promise.resolve().then(() => programHistory.clear())
    console.log('Loaded program:', program.value.attributes.name, filePath ? `(${filePath})` : '')
  }

  /** 重置为空白画布 */
  function resetToEmpty() {
    // 清理执行状态（来自 useExecution 的 resetExecution）
    onBeforeLoad?.value?.()
    for (const key of Object.keys(functionExecutionEnabled)) {
      delete functionExecutionEnabled[key]
    }
    activeFunctionName.value = 'Main'
    program.value = createEmptyProgram()
    engine.value = new FlowchartEngine(activeFunction.value, LP, { program: program.value })
    nodes.value = [...engine.value.nodes]
    edges.value = [...engine.value.edges]
    currentFilePath.value = null
    isNewFile.value = true
    fileLoadVersion.value++
    // 推迟到下一微任务：等 Vue pre-flush watcher 记录完旧值后再清空历史
    Promise.resolve().then(() => programHistory.clear())
  }

  // ============================================
  // 视口定位
  // ============================================

  async function doFitToStartNode() {
    containerRect.value = getContainerRect()
    await fitToStartNode({
      zoom: settingsStore.defaultZoom,
      yOffset: settingsStore.yOffset,
    })
    // 同步 vpZoom/vpX/vpY 到调试面板滑块（静默更新，不触发 watcher 的 setViewport 重复调用）
    const actualZoom = settingsStore.defaultZoom
    vpZoom.value = actualZoom
  }

  // ============================================
  // 撤销 / 重做
  // ============================================

  function undo() {
    programHistory.undo()
    rebuildEngine()
  }

  function redo() {
    programHistory.redo()
    rebuildEngine()
  }

  // ============================================
  // 语言切换
  // ============================================

  function onLanguageChanged() {
    rebuildEngine()
  }

  // ============================================
  // 最近文件
  // ============================================

  async function refreshRecentFiles() {
    await recentFilesStore.load()
  }

  // ============================================
  // 文件 I/O
  // ============================================

  /** 打开文件 */
  async function handleOpen() {
    const result = await showOpenDialog([
      { name: t('fileDialog.flowgorithmFile'), extensions: ['fprg'] },
    ])
    if (result) {
      loadProgram(result.content, result.filePath)
      await recentFilesStore.addFile(result.filePath)
      await refreshRecentFiles()
      await nextTick()
      await doFitToStartNode()
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
      await recentFilesStore.addFile(currentFilePath.value)
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
        await recentFilesStore.addFile(savePath)
        await refreshRecentFiles()
        showToast(t('toasts.saveAsSuccess'), 'success')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[save-as failed]', e)
      showToast(t('toasts.saveAsFailed', { message: msg }), 'error')
    }
  }

  // ============================================
  // 应用初始化
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
    resetToEmpty()
    await refreshRecentFiles()
    console.log('[initApp] blank canvas created')
  }

  // ============================================
  // 导出
  // ============================================

  return {
    // Core state
    program,
    engine: engine as Ref<FlowchartEngine>,
    nodes,
    edges,
    LP,
    activeFunctionName,
    activeFunction,
    isContentReady,

    // File state
    currentFilePath,
    isNewFile,
    fileLoadVersion,
    recentFilesStore,

    // Undo/redo
    isDirty,
    canUndo,
    canRedo,

    // Function execution toggles
    functionExecutionEnabled,

    // Selection
    selectedNodeId,

    // Viewport
    vpZoom,
    vpX,
    vpY,
    containerRect,

    // Methods
    rebuildEngine,
    loadProgram,
    resetToEmpty,
    undo,
    redo,
    handleOpen,
    handleSave,
    handleSaveAs,
    initApp,
    refreshRecentFiles,
    doFitToStartNode,
    syncSelectionState,
    onLanguageChanged,
  }
}
