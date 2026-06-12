<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FunctionDef, Parameter } from '../engine/fprg-ast'
import { X, Plus, Trash2, Clipboard } from './icons'

const { t } = useI18n()

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  visible: boolean
  function: FunctionDef | null   // null = 新建模式
  existingNames: string[]
}>()

const emit = defineEmits<{
  close: []
  save: [func: FunctionDef]
}>()

// ============================================================
// Local state
// ============================================================

const isNew = computed(() => props.function === null)

const name = ref('')
const returnType = ref('None')
const returnVariable = ref('')
const params = reactive<Parameter[]>([])

const nameError = ref('')

const RETURN_TYPES = ['None', 'Integer', 'Real', 'String', 'Boolean']

// ============================================================
// Watch: sync props → local state
// ============================================================

watch(
  () => [props.visible, props.function] as const,
  ([visible, func]) => {
    if (visible) {
      if (func) {
        name.value = func.name
        returnType.value = func.type || 'None'
        returnVariable.value = func.variable || ''
        params.splice(0, params.length, ...func.parameters.map(p => ({ ...p })))
      } else {
        name.value = ''
        returnType.value = 'None'
        returnVariable.value = ''
        params.length = 0
      }
      nameError.value = ''
    }
  },
  { immediate: true },
)

// ============================================================
// Computed
// ============================================================

const showReturnVar = computed(() => returnType.value !== 'None' && returnType.value !== '')

const canSave = computed(() => {
  return name.value.trim().length > 0 && !nameError.value
})

// ============================================================
// Validation
// ============================================================

function validateName() {
  const n = name.value.trim()
  if (!n) {
    nameError.value = t('functions.nameRequired')
    return
  }
  // Check duplicate (exclude self)
  if (props.existingNames.some(existing => {
    if (isNew.value) return existing === n
    return existing === n && existing !== props.function!.name
  })) {
    nameError.value = t('functions.nameDuplicate', { name: n })
    return
  }
  // No spaces
  if (/\s/.test(n)) {
    nameError.value = '函数名不能包含空格'
    return
  }
  nameError.value = ''
}

// ============================================================
// Parameter CRUD
// ============================================================

function addParam() {
  params.push({ name: '', type: 'Integer', array: false })
}

function removeParam(index: number) {
  params.splice(index, 1)
}

// ============================================================
// Save
// ============================================================

function onSave() {
  validateName()
  if (nameError.value) return

  const funcDef: FunctionDef = {
    kind: 'function',
    name: name.value.trim(),
    type: returnType.value,
    variable: showReturnVar.value ? returnVariable.value.trim() : '',
    parameters: params.filter(p => p.name.trim()).map(p => ({
      name: p.name.trim(),
      type: p.type,
      array: p.array,
    })),
    body: props.function?.body ?? [],
  }

  emit('save', funcDef)
}

// ============================================================
// Keyboard: Escape to close, Enter on name to save
// ============================================================

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Transition name="dialog-fade">
    <div v-if="visible" class="fn-dialog-overlay" @mousedown.self="emit('close')">
      <div class="fn-dialog">
        <!-- Header -->
        <div class="fn-dialog-header">
          <Clipboard :size="18" class="fn-dialog-icon" />
          <span class="fn-dialog-title">
            {{ isNew ? $t('functions.newFunction') : $t('functions.editFunction', { name: props.function?.name }) }}
          </span>
          <button class="fn-dialog-close" @click="emit('close')" :title="$t('common.close')">
            <X :size="14" />
          </button>
        </div>

        <!-- Body -->
        <div class="fn-dialog-body">
          <!-- Function Name -->
          <label class="fn-field">
            <span class="fn-field-label">{{ $t('functions.functionName') }}</span>
            <input
              v-model="name"
              class="fn-field-input"
              :class="{ 'has-error': nameError }"
              type="text"
              placeholder="myFunction"
              :readonly="!isNew && props.function?.name === 'Main'"
              @input="validateName"
              @keydown.enter="onSave"
            />
            <span v-if="nameError" class="fn-field-error">{{ nameError }}</span>
          </label>

          <!-- Return Type -->
          <label class="fn-field">
            <span class="fn-field-label">{{ $t('functions.returnType') }}</span>
            <select v-model="returnType" class="fn-field-select">
              <option v-for="rt in RETURN_TYPES" :key="rt" :value="rt">
                {{ rt === 'None' ? $t('functions.noReturn') : rt }}
              </option>
            </select>
          </label>

          <!-- Return Variable -->
          <label v-if="showReturnVar" class="fn-field">
            <span class="fn-field-label">{{ $t('functions.returnVariable') }}</span>
            <input
              v-model="returnVariable"
              class="fn-field-input"
              type="text"
              placeholder="result"
            />
          </label>

          <!-- Parameters -->
          <div class="fn-params-section">
            <div class="fn-params-header">
              <span class="fn-field-label">{{ $t('functions.parameters') }}</span>
              <button class="fn-add-param-btn" @click="addParam">
                <Plus :size="13" />
                {{ $t('functions.addParameter') }}
              </button>
            </div>

            <table v-if="params.length > 0" class="fn-params-table">
              <thead>
                <tr>
                  <th>{{ $t('functions.paramName') }}</th>
                  <th>{{ $t('functions.paramType') }}</th>
                  <th>{{ $t('functions.paramArray') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(p, i) in params" :key="i">
                  <td>
                    <input
                      v-model="p.name"
                      class="fn-param-input"
                      type="text"
                      placeholder="x"
                    />
                  </td>
                  <td>
                    <select v-model="p.type" class="fn-param-select">
                      <option>Integer</option>
                      <option>Real</option>
                      <option>String</option>
                      <option>Boolean</option>
                    </select>
                  </td>
                  <td class="fn-param-check">
                    <input v-model="p.array" type="checkbox" />
                  </td>
                  <td>
                    <button class="fn-param-remove" @click="removeParam(i)" :title="$t('common.delete')">
                      <Trash2 :size="13" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-else class="fn-params-empty">
              {{ $t('functions.noParameters') }}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="fn-dialog-footer">
          <button class="fn-dialog-btn fn-dialog-btn-cancel" @click="emit('close')">
            {{ $t('common.cancel') }}
          </button>
          <button class="fn-dialog-btn fn-dialog-btn-save" :disabled="!canSave" @click="onSave">
            {{ $t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fn-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10002;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.fn-dialog {
  background: var(--dialog-bg);
  border: 1px solid var(--dialog-border);
  border-radius: 12px;
  box-shadow: var(--shadow-dialog);
  min-width: 420px;
  max-width: 520px;
  overflow: hidden;
}

/* ---- Header ---- */
.fn-dialog-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color);
}

.fn-dialog-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.fn-dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.fn-dialog-close {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

.fn-dialog-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #e74c3c;
}

/* ---- Body ---- */
.fn-dialog-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 60vh;
  overflow-y: auto;
}

.fn-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.fn-field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.fn-field-input,
.fn-field-select {
  padding: 8px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}

.fn-field-input:focus,
.fn-field-select:focus {
  border-color: var(--accent);
}

.fn-field-input.has-error {
  border-color: #e74c3c;
}

.fn-field-input:read-only {
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.02);
  cursor: default;
}

.fn-field-error {
  font-size: 11px;
  color: #e74c3c;
}

.fn-field-select {
  cursor: pointer;
}

/* ---- Parameters ---- */
.fn-params-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fn-params-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.fn-add-param-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border-soft);
  border-radius: 5px;
  color: var(--text-muted);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.fn-add-param-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--accent);
}

.fn-params-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.fn-params-table th {
  text-align: left;
  padding: 4px 6px;
  color: var(--text-muted-3);
  font-weight: 500;
  font-size: 10px;
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-soft);
}

.fn-params-table td {
  padding: 3px 4px;
}

.fn-param-input,
.fn-param-select {
  width: 100%;
  padding: 5px 8px;
  background: var(--bg-input);
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 12px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}

.fn-param-input:focus,
.fn-param-select:focus {
  border-color: var(--accent);
}

.fn-param-select {
  cursor: pointer;
}

.fn-param-check {
  text-align: center;
}

.fn-param-check input {
  cursor: pointer;
  accent-color: var(--accent);
}

.fn-param-remove {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  color: var(--text-muted-2);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

.fn-param-remove:hover {
  background: rgba(231, 76, 60, 0.12);
  color: #e74c3c;
}

.fn-params-empty {
  text-align: center;
  padding: 14px;
  color: var(--text-placeholder);
  font-size: 12px;
  font-style: italic;
  border: 1px dashed var(--border-soft);
  border-radius: 6px;
}

/* ---- Footer ---- */
.fn-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
}

.fn-dialog-btn {
  padding: 7px 18px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.fn-dialog-btn:active {
  transform: scale(0.96);
}

.fn-dialog-btn-cancel {
  background: var(--btn-cancel-bg);
  color: var(--text-secondary);
}

.fn-dialog-btn-cancel:hover {
  background: var(--btn-cancel-hover);
}

.fn-dialog-btn-save {
  background: var(--btn-primary-bg);
  color: #fff;
}

.fn-dialog-btn-save:hover:not(:disabled) {
  background: var(--btn-primary-hover);
}

.fn-dialog-btn-save:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ---- Transition ---- */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-active .fn-dialog,
.dialog-fade-leave-active .fn-dialog {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .fn-dialog,
.dialog-fade-leave-to .fn-dialog {
  transform: scale(0.95);
  opacity: 0;
}
</style>
