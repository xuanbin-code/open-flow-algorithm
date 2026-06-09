<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'

// ============================================================
// Props & Emits
// ============================================================

const props = defineProps<{
  visible: boolean
  variableName: string
}>()

const emit = defineEmits<{
  submit: [value: string]
  cancel: []
}>()

// ============================================================
// State
// ============================================================

const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

// 打开时自动聚焦输入框
watch(
  () => props.visible,
  async (v) => {
    if (v) {
      inputValue.value = ''
      await nextTick()
      inputRef.value?.focus()
    }
  },
)

// ============================================================
// Keyboard handling
// ============================================================

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    onSubmit()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('cancel')
  }
}

function onSubmit() {
  emit('submit', inputValue.value)
}

// 全局 Escape 监听（组件挂载时）
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Transition name="dialog-fade">
    <div v-if="visible" class="input-dialog-overlay" @mousedown.self="emit('cancel')">
      <div class="input-dialog">
        <div class="dialog-header">
          <span class="dialog-icon">⌨</span>
          <span class="dialog-title">输入</span>
        </div>

        <div class="dialog-body">
          <p class="dialog-prompt">
            请输入变量「<strong>{{ variableName }}</strong>」的值：
          </p>
          <input
            ref="inputRef"
            v-model="inputValue"
            class="dialog-input"
            type="text"
            placeholder="在此输入..."
            @keydown="onKeydown"
          />
        </div>

        <div class="dialog-footer">
          <button class="dialog-btn dialog-btn-cancel" @click="emit('cancel')">
            取消
          </button>
          <button class="dialog-btn dialog-btn-submit" @click="onSubmit">
            确定
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.input-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10001;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.input-dialog {
  background: #1e1e32;
  border: 1px solid #555;
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7);
  min-width: 360px;
  max-width: 480px;
  overflow: hidden;
}

/* ---- Header ---- */
.dialog-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid #333;
}

.dialog-icon {
  font-size: 20px;
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #eee;
}

/* ---- Body ---- */
.dialog-body {
  padding: 20px;
}

.dialog-prompt {
  color: #bbb;
  font-size: 14px;
  margin: 0 0 14px 0;
  line-height: 1.5;
}

.dialog-prompt strong {
  color: #4fc3f7;
  font-weight: 600;
}

.dialog-input {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid #555;
  border-radius: 6px;
  color: #eee;
  font-size: 15px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.dialog-input:focus {
  border-color: #4fc3f7;
}

.dialog-input::placeholder {
  color: #666;
}

/* ---- Footer ---- */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid #333;
}

.dialog-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.dialog-btn:active {
  transform: scale(0.96);
}

.dialog-btn-cancel {
  background: rgba(255, 255, 255, 0.08);
  color: #ccc;
}
.dialog-btn-cancel:hover {
  background: rgba(255, 255, 255, 0.15);
}

.dialog-btn-submit {
  background: #3498db;
  color: #fff;
}
.dialog-btn-submit:hover {
  background: #2980b9;
}

/* ---- Transition ---- */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}
.dialog-fade-enter-active .input-dialog,
.dialog-fade-leave-active .input-dialog {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
.dialog-fade-enter-from .input-dialog,
.dialog-fade-leave-to .input-dialog {
  transform: scale(0.95);
  opacity: 0;
}
</style>
