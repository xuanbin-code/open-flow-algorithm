<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { VueFlow, Panel } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import {
  StartNode,
  EndNode,
  DeclareNode,
  AssignNode,
  InputNode,
  OutputNode,
  IfNode,
  MergeNode,
  ForNode,
  WhileNode,
  CallNode,
  BreakNode,
  ContinueNode,
  ReturnNode,
} from "./components/nodes";
import {
  InsertNodePanel,
  LayoutDebugPanel,
  QuickActionsBar,
  NodeContextMenu,
  ExecutionConsole,
  VariableMonitor,
  SettingsDialog,
  FunctionParamInputDialog,
} from "./components/panels";
import {
  ExecutionCallCanvas,
  FunctionDialog,
  FunctionTabBar,
  MenuBar,
} from "./components";
import { Check, X } from "@/lib/icons";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";

import { readFile, showSaveDialog, writeFile, exportToPython, isPythonBackendAvailable } from "@/platform";
import { PARAM_DEFS } from "./engine/flowchartEngine";
import { useSettingsStore } from "./stores/settings";
import { useSound } from "./composables/useSound";
import { useToast } from "./composables/useToast";
import { useKeyboardShortcuts } from "./composables/useKeyboardShortcuts";
import { useProgram } from "./composables/useProgram";
import { useFunctionManagement } from "./composables/useFunctionManagement";
import { useExecution } from "./composables/useExecution";
import { useNodeInteraction } from "./composables/useNodeInteraction";
import { useI18n } from "vue-i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";

// ============================================
// Composables
// ============================================

const { t } = useI18n();
const sound = useSound();
const { toast, showToast, hideToast } = useToast();

// 跨 composable 回调桥接
const beforeLoadRef = ref<(() => void) | null>(null);

// ---- useProgram ----
const prog = useProgram({ showToast, onBeforeLoad: beforeLoadRef })
const {
  program,
  nodes,
  edges,
  LP,
  activeFunctionName,
  activeFunction,
  isContentReady,
  currentFilePath,
  isNewFile,
  fileLoadVersion,
  recentFilesStore,
  isDirty,
  canUndo,
  canRedo,
  functionExecutionEnabled,
  selectedNodeId,
  vpZoom,
  vpX,
  vpY,
  containerRect,
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
  onLanguageChanged,
} = prog;

// 设置 store
const settingsStore = useSettingsStore();

// ---- useExecution ----
const {
  executionStatus,
  executionSpeed,
  isExecuting,
  varEntries,
  chatMessages,
  inputVariableName,
  invocations,
  callCanvasVisible,
  startExecution,
  stepExecution,
  stopExecution,
  pauseExecution,
  resumeExecution,
  setExecutionSpeed,
  clearOutput,
  onInputSubmit,
  onInputCancel,
  resetExecution,
  onHighlightNode,
  showParamDialog,
  paramDialogFunction,
  onParamDialogConfirm,
  onParamDialogCancel,
} = useExecution({
  program,
  activeFunction,
  functionExecutionEnabled,
  nodes,
  edges,
  LP,
  sound,
  showToast,
});

// 连接 useProgram.loadProgram → useExecution.resetExecution
beforeLoadRef.value = resetExecution;

// ---- useNodeInteraction ----
const {
  panelVisible,
  panelPosition,
  editingStatement,
  onEdgeClick,
  onNodeClick,
  onNodeDblClick,
  onPaneClick,
  onNodeContextMenu,
  handleNodeContextEdit,
  deleteSelectedNode,
  deleteNodeById,
  canDeleteNode,
  canEditNode,
  onInsertNode,
  onUpdateProperty,
  onCloseEditor,
} = useNodeInteraction({
  engine: prog.engine,
  nodes,
  edges,
  program,
  isExecuting,
  selectedNodeId,
  rebuildEngine,
});

// ---- useFunctionManagement ----
const {
  showFunctionDialog,
  editingFunction,
  onSwitchFunction,
  onAddFunction,
  onSaveFunction,
  onRenameFunction,
  onDeleteFunction,
  onToggleExecution,
} = useFunctionManagement({
  program,
  activeFunctionName,
  isExecuting,
  functionExecutionEnabled,
  rebuildEngine,
  doFitToStartNode,
});

// ---- useKeyboardShortcuts ----
const { onKeydown } = useKeyboardShortcuts({
  isExecuting,
  selectedNodeId,
  handleSave,
  undo,
  redo,
  deleteSelectedNode,
  handleNew: () => { resetToEmpty(); nextTick(() => { doFitToStartNode(); }); },
  handleOpen,
  run: startExecution,
  step: stepExecution,
  stop: stopExecution,
});

// ============================================
// 局部状态
// ============================================

const showSettingsDialog = ref(false);
const showVariableMonitor = ref(true);
const variableMonitorMode = ref<"embedded" | "window">("embedded");
const varMonitorAnchor = ref<HTMLElement | null>(null);

// ============================================
// 导出为 Python 代码
// ============================================

async function handleExportPython() {
  if (!isPythonBackendAvailable()) {
    showToast(t("toasts.pythonBackendNotAvailable"), "error")
    return
  }

  try {
    // Show save dialog
    const filePath = await showSaveDialog([
      { name: t("fileDialog.pythonFile") || "Python Files", extensions: ["py"] },
    ])

    if (!filePath) return // User cancelled

    // Generate Python code
    const ast = JSON.parse(JSON.stringify(program.value))
    const sourceCode = await exportToPython(ast)

    // Write to file
    await writeFile(filePath, sourceCode)
    showToast(t("toasts.exportPythonSuccess", { path: filePath }), "success")
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    showToast(t("toasts.exportPythonError", { message: msg }), "error")
  }
}

// ============================================
// 菜单栏事件调度器
// ============================================

async function onMenuAction(actionId: string) {
  if (actionId.startsWith("open-recent:")) {
    const filePath = actionId.slice("open-recent:".length);
    try {
      const xml = await readFile(filePath);
      loadProgram(xml, filePath);
      await recentFilesStore.addFile(filePath);
      await refreshRecentFiles();
      await nextTick();
      await doFitToStartNode();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(t("toasts.cannotOpenFile", { message: msg }), "error");
    }
    return;
  }

  switch (actionId) {
    case "new": {
      resetToEmpty();
      await nextTick();
      await doFitToStartNode();
      break;
    }
    case "open": {
      await handleOpen();
      break;
    }
    case "save": {
      await handleSave();
      break;
    }
    case "saveAs": {
      await handleSaveAs();
      break;
    }
    case "undo": {
      undo();
      break;
    }
    case "redo": {
      redo();
      break;
    }
    case "run": {
      startExecution();
      break;
    }
    case "step": {
      stepExecution();
      break;
    }
    case "stop": {
      stopExecution();
      break;
    }
    case "speed-slow": {
      setExecutionSpeed("slow");
      break;
    }
    case "speed-normal": {
      setExecutionSpeed("normal");
      break;
    }
    case "speed-fast": {
      setExecutionSpeed("fast");
      break;
    }
    case "export-python": {
      await handleExportPython();
      break;
    }
    case "open-settings": {
      showSettingsDialog.value = true;
      break;
    }
    case "manage-functions": {
      onAddFunction();
      break;
    }
    default:
      console.log(`Menu action: ${actionId} (not implemented)`);
  }
}

// ============================================
// 生命周期
// ============================================

onMounted(async () => {
  await initApp();
  isContentReady.value = true;
  await nextTick();
  await doFitToStartNode();
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("language-changed", onLanguageChanged);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("language-changed", onLanguageChanged);
});
</script>

<template>
  <div id="app">
    <MenuBar
      :recent-files="recentFilesStore.files"
      :current-file-path="currentFilePath"
      :is-new-file="isNewFile"
      :is-dirty="isDirty"
      :execution-status="executionStatus"
      :execution-speed="executionSpeed"
      @action="onMenuAction"
      @run="startExecution"
      @step="stepExecution"
      @pause="pauseExecution"
      @resume="resumeExecution"
      @stop="stopExecution"
      @set-speed="setExecutionSpeed"
    />
    <div class="main-area">
      <FunctionTabBar
        :key="fileLoadVersion"
        :functions="program.functions"
        :active-function="activeFunctionName"
        :execution-enabled="functionExecutionEnabled"
        @switch-function="onSwitchFunction"
        @add-function="onAddFunction"
        @rename-function="onRenameFunction"
        @delete-function="onDeleteFunction"
        @toggle-execution="onToggleExecution"
      />
      <div class="center-area">
        <div
          class="flow-container"
          :class="{ 'flow-ready': isContentReady }"
          @contextmenu="onNodeContextMenu"
        >
          <TooltipProvider :delay-duration="500">
            <VueFlow
              :key="activeFunctionName"
              :nodes="nodes"
              :edges="edges"
              :default-viewport="{ zoom: 1, x: 50, y: 20 }"
              :min-zoom="0.1"
              :max-zoom="4"
              :delete-key-code="null"
              @edge-click="onEdgeClick"
              @node-click="onNodeClick"
              @node-double-click="onNodeDblClick"
              @pane-click="onPaneClick"
            >
              <Panel position="top-left">
                <div ref="varMonitorAnchor"></div>
              </Panel>
              <Panel position="top-right">
                <QuickActionsBar
                  :can-save="isDirty"
                  :can-undo="canUndo"
                  :can-redo="canRedo"
                  :is-executing="isExecuting"
                  @save="handleSave"
                  @open="handleOpen"
                  @undo="undo"
                  @redo="redo"
                />
              </Panel>
              <Background pattern-color="#aaa" :gap="20" />
              <Controls />
              <!-- Start / End / Merge: non-editable, non-deletable -->
              <template #node-start="nodeProps">
                <ContextMenu>
                  <ContextMenuTrigger as-child @contextmenu="onNodeContextMenu">
                    <StartNode v-bind="nodeProps" />
                  </ContextMenuTrigger>
                  <NodeContextMenu
                    :node-id="nodeProps.id"
                    :can-delete="false"
                    :can-edit="false"
                    @edit="handleNodeContextEdit"
                    @delete="deleteNodeById"
                  />
                </ContextMenu>
              </template>
              <template #node-end="nodeProps">
                <ContextMenu>
                  <ContextMenuTrigger as-child @contextmenu="onNodeContextMenu">
                    <EndNode v-bind="nodeProps" />
                  </ContextMenuTrigger>
                  <NodeContextMenu
                    :node-id="nodeProps.id"
                    :can-delete="false"
                    :can-edit="false"
                    @edit="handleNodeContextEdit"
                    @delete="deleteNodeById"
                  />
                </ContextMenu>
              </template>
              <template #node-fg-merge="nodeProps">
                <ContextMenu>
                  <ContextMenuTrigger as-child @contextmenu="onNodeContextMenu">
                    <MergeNode v-bind="nodeProps" />
                  </ContextMenuTrigger>
                  <NodeContextMenu
                    :node-id="nodeProps.id"
                    :can-delete="false"
                    :can-edit="false"
                    @edit="handleNodeContextEdit"
                    @delete="deleteNodeById"
                  />
                </ContextMenu>
              </template>

              <!-- Editable / deletable nodes -->
              <template #node-default="nodeProps">
                <ContextMenu>
                  <ContextMenuTrigger as-child @contextmenu="onNodeContextMenu">
                    <div
                      class="default-node-fallback"
                      :class="{ 'is-empty': nodeProps.data?.isEmpty }"
                      :style="{
                        width: (nodeProps.data?.width ?? 120) + 'px',
                        height: (nodeProps.data?.height ?? 50) + 'px',
                      }"
                    >
                      {{ nodeProps.data?.label ?? "" }}
                    </div>
                  </ContextMenuTrigger>
                  <NodeContextMenu
                    :node-id="nodeProps.id"
                    :can-delete="canDeleteNode(nodeProps)"
                    :can-edit="canEditNode(nodeProps)"
                    @edit="handleNodeContextEdit"
                    @delete="deleteNodeById"
                  />
                </ContextMenu>
              </template>
              <template #node-declare="nodeProps">
                <ContextMenu>
                  <ContextMenuTrigger as-child @contextmenu="onNodeContextMenu">
                    <DeclareNode v-bind="nodeProps" />
                  </ContextMenuTrigger>
                  <NodeContextMenu
                    :node-id="nodeProps.id"
                    :can-delete="canDeleteNode(nodeProps)"
                    :can-edit="canEditNode(nodeProps)"
                    @edit="handleNodeContextEdit"
                    @delete="deleteNodeById"
                  />
                </ContextMenu>
              </template>
              <template #node-assign="nodeProps">
                <ContextMenu>
                  <ContextMenuTrigger as-child @contextmenu="onNodeContextMenu">
                    <AssignNode v-bind="nodeProps" />
                  </ContextMenuTrigger>
                  <NodeContextMenu
                    :node-id="nodeProps.id"
                    :can-delete="canDeleteNode(nodeProps)"
                    :can-edit="canEditNode(nodeProps)"
                    @edit="handleNodeContextEdit"
                    @delete="deleteNodeById"
                  />
                </ContextMenu>
              </template>
              <template #node-fg-input="nodeProps">
                <ContextMenu>
                  <ContextMenuTrigger as-child @contextmenu="onNodeContextMenu">
                    <InputNode v-bind="nodeProps" />
                  </ContextMenuTrigger>
                  <NodeContextMenu
                    :node-id="nodeProps.id"
                    :can-delete="canDeleteNode(nodeProps)"
                    :can-edit="canEditNode(nodeProps)"
                    @edit="handleNodeContextEdit"
                    @delete="deleteNodeById"
                  />
                </ContextMenu>
              </template>
              <template #node-fg-output="nodeProps">
                <ContextMenu>
                  <ContextMenuTrigger as-child @contextmenu="onNodeContextMenu">
                    <OutputNode v-bind="nodeProps" />
                  </ContextMenuTrigger>
                  <NodeContextMenu
                    :node-id="nodeProps.id"
                    :can-delete="canDeleteNode(nodeProps)"
                    :can-edit="canEditNode(nodeProps)"
                    @edit="handleNodeContextEdit"
                    @delete="deleteNodeById"
                  />
                </ContextMenu>
              </template>
              <template #node-fg-if="nodeProps">
                <ContextMenu>
                  <ContextMenuTrigger as-child @contextmenu="onNodeContextMenu">
                    <IfNode v-bind="nodeProps" />
                  </ContextMenuTrigger>
                  <NodeContextMenu
                    :node-id="nodeProps.id"
                    :can-delete="canDeleteNode(nodeProps)"
                    :can-edit="canEditNode(nodeProps)"
                    @edit="handleNodeContextEdit"
                    @delete="deleteNodeById"
                  />
                </ContextMenu>
              </template>
              <template #node-fg-for="nodeProps">
                <ContextMenu>
                  <ContextMenuTrigger as-child @contextmenu="onNodeContextMenu">
                    <ForNode v-bind="nodeProps" />
                  </ContextMenuTrigger>
                  <NodeContextMenu
                    :node-id="nodeProps.id"
                    :can-delete="canDeleteNode(nodeProps)"
                    :can-edit="canEditNode(nodeProps)"
                    @edit="handleNodeContextEdit"
                    @delete="deleteNodeById"
                  />
                </ContextMenu>
              </template>
              <template #node-fg-while="nodeProps">
                <ContextMenu>
                  <ContextMenuTrigger as-child @contextmenu="onNodeContextMenu">
                    <WhileNode v-bind="nodeProps" />
                  </ContextMenuTrigger>
                  <NodeContextMenu
                    :node-id="nodeProps.id"
                    :can-delete="canDeleteNode(nodeProps)"
                    :can-edit="canEditNode(nodeProps)"
                    @edit="handleNodeContextEdit"
                    @delete="deleteNodeById"
                  />
                </ContextMenu>
              </template>
              <template #node-call="nodeProps">
                <ContextMenu>
                  <ContextMenuTrigger as-child @contextmenu="onNodeContextMenu">
                    <CallNode v-bind="nodeProps" />
                  </ContextMenuTrigger>
                  <NodeContextMenu
                    :node-id="nodeProps.id"
                    :can-delete="canDeleteNode(nodeProps)"
                    :can-edit="canEditNode(nodeProps)"
                    @edit="handleNodeContextEdit"
                    @delete="deleteNodeById"
                  />
                </ContextMenu>
              </template>
              <template #node-break="nodeProps">
                <ContextMenu>
                  <ContextMenuTrigger as-child @contextmenu="onNodeContextMenu">
                    <BreakNode v-bind="nodeProps" />
                  </ContextMenuTrigger>
                  <NodeContextMenu
                    :node-id="nodeProps.id"
                    :can-delete="canDeleteNode(nodeProps)"
                    :can-edit="canEditNode(nodeProps)"
                    @edit="handleNodeContextEdit"
                    @delete="deleteNodeById"
                  />
                </ContextMenu>
              </template>
              <template #node-continue="nodeProps">
                <ContextMenu>
                  <ContextMenuTrigger as-child @contextmenu="onNodeContextMenu">
                    <ContinueNode v-bind="nodeProps" />
                  </ContextMenuTrigger>
                  <NodeContextMenu
                    :node-id="nodeProps.id"
                    :can-delete="canDeleteNode(nodeProps)"
                    :can-edit="canEditNode(nodeProps)"
                    @edit="handleNodeContextEdit"
                    @delete="deleteNodeById"
                  />
                </ContextMenu>
              </template>
              <template #node-return="nodeProps">
                <ContextMenu>
                  <ContextMenuTrigger as-child @contextmenu="onNodeContextMenu">
                    <ReturnNode v-bind="nodeProps" />
                  </ContextMenuTrigger>
                  <NodeContextMenu
                    :node-id="nodeProps.id"
                    :can-delete="canDeleteNode(nodeProps)"
                    :can-edit="canEditNode(nodeProps)"
                    @edit="handleNodeContextEdit"
                    @delete="deleteNodeById"
                  />
                </ContextMenu>
              </template>
            </VueFlow>
          </TooltipProvider>
        </div>
        <ExecutionCallCanvas
          ref="callCanvasRef"
          :invocations="invocations"
          :visible="callCanvasVisible"
        />
      </div>
      <div class="right-panel">
        <ExecutionConsole
          class="execution-console"
          :chat-messages="chatMessages"
          :execution-status="executionStatus"
          :variable-name="inputVariableName"
          @clear="clearOutput"
          @submit-input="onInputSubmit"
          @cancel-input="onInputCancel"
          @highlight-node="onHighlightNode"
        />
      </div>
    </div>
    <VariableMonitor
      :variables="varEntries"
      :visible="showVariableMonitor"
      :mode="variableMonitorMode"
      :embed-anchor="varMonitorAnchor"
      @toggle-mode="
        variableMonitorMode =
          variableMonitorMode === 'embedded' ? 'window' : 'embedded'
      "
    />
    <LayoutDebugPanel
      :params="LP"
      :definitions="PARAM_DEFS"
      v-model:vp-zoom="vpZoom"
      v-model:vp-x="vpX"
      v-model:vp-y="vpY"
      :default-zoom="settingsStore.defaultZoom"
      :y-offset="settingsStore.yOffset"
      :container-rect="containerRect"
      @update:default-zoom="(val: number) => (settingsStore.defaultZoom = val)"
      @update:y-offset="(val: number) => (settingsStore.yOffset = val)"
      @fit-to-start="doFitToStartNode()"
    />
    <InsertNodePanel
      v-if="panelVisible"
      :position="panelPosition"
      :editing-statement="editingStatement"
      :all-functions="program.functions"
      @close="
        panelVisible = false;
        editingStatement = null;
      "
      @insert="onInsertNode"
      @update-property="onUpdateProperty"
      @close-editor="onCloseEditor"
    />
    <FunctionDialog
      :visible="showFunctionDialog"
      :function="editingFunction"
      :existing-names="program.functions.map((f) => f.name)"
      @close="
        showFunctionDialog = false;
        editingFunction = null;
      "
      @save="onSaveFunction"
    />
    <SettingsDialog
      :visible="showSettingsDialog"
      @close="showSettingsDialog = false"
    />
    <FunctionParamInputDialog
      :visible="showParamDialog"
      :func-def="paramDialogFunction"
      @confirm="onParamDialogConfirm"
      @cancel="onParamDialogCancel"
    />
    <!-- Toast 消息 -->
    <Transition name="toast-fade">
      <div v-if="toast.visible" class="toast" :class="toast.type">
        <div class="toast-progress"></div>
        <div class="toast-body">
          <component
            :is="toast.type === 'success' ? Check : X"
            class="toast-icon"
            :size="16"
          />
          <span class="toast-text">{{ toast.message }}</span>
          <button class="toast-close" @click="hideToast">
            <X :size="14" />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
#app {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(
      circle at top left,
      color-mix(in srgb, var(--accent) 10%, transparent),
      transparent 30%
    ),
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
.center-area {
  flex: 1;
  min-width: 0;
  position: relative;
}
.flow-container {
  position: relative;
  width: 100%;
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
.right-panel {
  width: 400px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
}
.execution-console {
  flex: 1;
  min-height: 0;
  height: auto;
  border: 1px solid var(--border-soft) !important;
  border-radius: 10px !important;
  overflow: hidden !important;
  box-shadow: var(--shadow-panel-soft) !important;
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

/* 执行流指示器 — 动画边路径（匹配节点执行发光的绿色主题） */
.vue-flow__edge.animated .vue-flow__edge-path {
  stroke: #35d07f;
  stroke-width: 2.5px;
}

/* ---- Toast ---- */
.toast {
  position: fixed;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  max-width: 380px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-dropdown);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  display: flex;
  flex-direction: column;
}

/* 顶部进度条 */
.toast-progress {
  height: 3px;
  width: 100%;
  animation: toast-shrink 3s linear forwards;
}
.toast.success .toast-progress {
  background: var(--accent-green);
}
.toast.error .toast-progress {
  background: var(--accent-red);
}

/* 内容区：图标 + 文本 */
.toast-body {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  color: var(--text-primary);
}

.toast-icon {
  flex-shrink: 0;
}
.toast.success .toast-icon {
  color: var(--accent-green);
}
.toast.error .toast-icon {
  color: var(--accent-red);
}

.toast-text {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 关闭按钮 */
.toast-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  pointer-events: auto;
  transition:
    background 0.15s,
    color 0.15s;
}
.toast-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

@keyframes toast-shrink {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px);
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
