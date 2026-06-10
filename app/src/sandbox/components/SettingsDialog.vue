<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useSettings } from '../../composables/useSettings'

// ============================================================
// Props & Emits
// ============================================================

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// ============================================================
// Settings state
// ============================================================

const { settings } = useSettings()

// ============================================================
// Theme toggle
// ============================================================

function toggleTheme() {
  settings.value.theme = settings.value.theme === 'dark' ? 'light' : 'dark'
}

// ============================================================
// Keyboard: Escape to close
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
    <div v-if="visible" class="settings-overlay" @mousedown.self="emit('close')">
      <div class="settings-dialog">
        <!-- Header -->
        <div class="dialog-header">
          <span class="dialog-icon">⚙</span>
          <span class="dialog-title">设置</span>
        </div>

        <!-- Body -->
        <div class="dialog-body">
          <!-- 1. Language (placeholder) -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">语言</span>
              <span class="setting-desc">界面显示语言</span>
            </div>
            <div class="setting-control">
              <select disabled class="setting-select">
                <option>中文 (简体)</option>
              </select>
              <span class="coming-soon-tag">即将推出</span>
            </div>
          </div>

          <!-- 2. Theme color (placeholder) -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">主题色</span>
              <span class="setting-desc">自定义强调色</span>
            </div>
            <div class="setting-control">
              <div class="color-swatches">
                <span class="swatch active" style="background: #4fc3f7"></span>
                <span class="swatch" style="background: #2ecc71; opacity: 0.4"></span>
                <span class="swatch" style="background: #e74c3c; opacity: 0.4"></span>
                <span class="swatch" style="background: #f39c12; opacity: 0.4"></span>
              </div>
              <span class="coming-soon-tag">即将推出</span>
            </div>
          </div>

          <!-- 3. Dark/Light toggle (functional) -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">深色 / 浅色模式</span>
              <span class="setting-desc">切换界面明暗主题</span>
            </div>
            <div class="setting-control">
              <button class="theme-toggle-btn" @click="toggleTheme">
                <span class="theme-icon">{{ settings.theme === 'dark' ? '🌙' : '☀️' }}</span>
                <span class="theme-label">{{ settings.theme === 'dark' ? '深色' : '浅色' }}</span>
              </button>
            </div>
          </div>

          <!-- 4. Sound effects (placeholder) -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">音效</span>
              <span class="setting-desc">运行、结束、报错时播放提示音</span>
            </div>
            <div class="setting-control">
              <div class="toggle-placeholder">
                <span class="toggle-knob off">○</span>
                <span class="toggle-state">关</span>
              </div>
              <span class="coming-soon-tag">即将推出</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="dialog-footer">
          <button class="dialog-btn dialog-btn-close" @click="emit('close')">
            关闭
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ---- Overlay ---- */
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 10001;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.settings-dialog {
  background: var(--dialog-bg);
  border: 1px solid var(--dialog-border);
  border-radius: 12px;
  box-shadow: var(--shadow-dialog);
  min-width: 420px;
  max-width: 520px;
  overflow: hidden;
}

/* ---- Header ---- */
.dialog-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color);
}

.dialog-icon {
  font-size: 20px;
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ---- Body ---- */
.dialog-body {
  padding: 8px 0;
}

/* ---- Setting rows ---- */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-soft);
}
.setting-row:last-child {
  border-bottom: none;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.setting-desc {
  font-size: 11px;
  color: var(--text-muted);
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ---- Placeholder select ---- */
.setting-select {
  padding: 6px 10px;
  background: var(--bg-input);
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  cursor: not-allowed;
  opacity: 0.5;
}

/* ---- Coming soon tag ---- */
.coming-soon-tag {
  font-size: 10px;
  color: var(--accent);
  background: rgba(79, 195, 247, 0.1);
  border: 1px solid rgba(79, 195, 247, 0.25);
  border-radius: 4px;
  padding: 1px 8px;
  white-space: nowrap;
  font-weight: 500;
}

/* ---- Color swatches ---- */
.color-swatches {
  display: flex;
  gap: 6px;
}

.swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
}
.swatch.active {
  border-color: var(--text-primary);
  transform: scale(1.1);
}

/* ---- Theme toggle button ---- */
.theme-toggle-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  background: var(--btn-cancel-bg);
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.theme-toggle-btn:hover {
  background: var(--btn-cancel-hover);
  border-color: var(--accent);
}

.theme-icon {
  font-size: 16px;
}

.theme-label {
  font-weight: 600;
}

/* ---- Toggle placeholder (sound effects) ---- */
.toggle-placeholder {
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.5;
}

.toggle-knob {
  font-size: 18px;
  color: var(--text-muted);
}

.toggle-state {
  font-size: 13px;
  color: var(--text-muted);
}

/* ---- Footer ---- */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
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

.dialog-btn-close {
  background: var(--btn-primary-bg);
  color: #fff;
}
.dialog-btn-close:hover {
  background: var(--btn-primary-hover);
}

/* ---- Transition ---- */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}
.dialog-fade-enter-active .settings-dialog,
.dialog-fade-leave-active .settings-dialog {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
.dialog-fade-enter-from .settings-dialog,
.dialog-fade-leave-to .settings-dialog {
  transform: scale(0.95);
  opacity: 0;
}
</style>
