// ============================================================
// useFunctionManagement.ts — 函数管理 composable
//
// 管理函数的增删改查、标签页切换、执行演示开关。
// ============================================================

import { ref, type Ref, type ComputedRef } from 'vue'
import { nextTick } from 'vue'
import {
  getFunctionByName,
  addFunction,
  deleteFunction,
  renameFunction,
  type Program,
  type Statement,
  type FunctionDef,
} from '../engine/fprgAst'

export interface UseFunctionManagementOptions {
  program: Ref<Program>
  activeFunctionName: Ref<string>
  isExecuting: ComputedRef<boolean>
  functionExecutionEnabled: Record<string, boolean>
  rebuildEngine: () => void
  doFitToStartNode: () => Promise<void>
}

export function useFunctionManagement(options: UseFunctionManagementOptions) {
  const {
    program,
    activeFunctionName,
    isExecuting,
    functionExecutionEnabled,
    rebuildEngine,
    doFitToStartNode,
  } = options

  const showFunctionDialog = ref(false)
  const editingFunction = ref<FunctionDef | null>(null)

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

  function onToggleExecution(funcName: string, enabled: boolean) {
    functionExecutionEnabled[funcName] = enabled
  }

  return {
    showFunctionDialog,
    editingFunction,
    onSwitchFunction,
    onAddFunction,
    onSaveFunction,
    onRenameFunction,
    onDeleteFunction,
    onToggleExecution,
  }
}
