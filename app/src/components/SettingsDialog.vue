<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettings } from '../composables/useSettings'
import { ACCENT_PRESETS } from '../utils/color-palette'
import { Sun, Moon, Settings, Check, Circle } from './icons'

const { t } = useI18n()

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
// Accent color state
// ============================================================

/** 当前选中的预设 id（若是自定义颜色则为 null） */
const activePresetId = computed(() => {
  const val = settings.value.accentColor
  if (val.startsWith('#')) return null
  return val
})

/** 自定义颜色的 hex 值 */
const customColorHex = computed({
  get: () => {
    const val = settings.value.accentColor
    return val.startsWith('#') ? val : '#4fc3f7'
  },
  set: (hex: string) => {
    settings.value.accentColor = hex
  },
})

function selectPreset(presetId: string) {
  settings.value.accentColor = presetId
}

function onCustomColorChange(e: Event) {
  const input = e.target as HTMLInputElement
  settings.value.accentColor = input.value
}

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
          <Settings class="dialog-icon" :size="20" />
          <span class="dialog-title">{{ $t('settings.title') }}</span>
        </div>

        <!-- Body -->
        <div class="dialog-body">
          <!-- 1. Language -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{{ $t('settings.languageLabel') }}</span>
              <span class="setting-desc">{{ $t('settings.languageDesc') }}</span>
            </div>
            <div class="setting-control">
              <select
                class="setting-select setting-select--active"
                :value="settings.language"
                @change="settings.language = ($event.target as HTMLSelectElement).value"
              >
                <option value="zh-CN">{{ $t('settings.zhCN') }}</option>
                <option value="en">{{ $t('settings.enUS') }}</option>
              </select>
            </div>
          </div>

          <!-- 2. Theme color -->
          <div class="setting-row setting-row-top">
            <div class="setting-info">
              <span class="setting-label">{{ $t('settings.themeColor') }}</span>
              <span class="setting-desc">{{ $t('settings.themeColorDesc') }}</span>
            </div>
            <div class="setting-control" />
          </div>
          <!-- Preset swatches -->
          <div class="accent-presets">
            <button
              v-for="preset in ACCENT_PRESETS"
              :key="preset.id"
              class="accent-preset-btn"
              :class="{ active: activePresetId === preset.id }"
              :title="preset.name"
              @click="selectPreset(preset.id)"
            >
              <span class="accent-swatch" :style="{ background: preset.dark }">
                <Check v-if="activePresetId === preset.id" class="accent-check" :size="14" />
              </span>
              <span class="accent-name">{{ preset.name }}</span>
            </button>
          </div>
          <!-- Custom color -->
          <div class="setting-row accent-custom-row">
            <div class="setting-info">
              <span class="setting-label">{{ $t('settings.customColor') }}</span>
            </div>
            <div class="setting-control">
              <input
                type="color"
                class="custom-color-input"
                :value="customColorHex"
                @input="onCustomColorChange"
              />
              <span class="custom-hex-label">{{ customColorHex }}</span>
            </div>
          </div>

          <!-- 3. Dark/Light toggle -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{{ $t('settings.darkLightMode') }}</span>
              <span class="setting-desc">{{ $t('settings.darkLightDesc') }}</span>
            </div>
            <div class="setting-control">
              <button class="theme-toggle-btn" @click="toggleTheme">
                <Moon v-if="settings.theme === 'dark'" class="theme-icon" :size="16" />
                <Sun v-else class="theme-icon" :size="16" />
                <span class="theme-label">{{ settings.theme === 'dark' ? $t('settings.dark') : $t('settings.light') }}</span>
              </button>
            </div>
          </div>

          <!-- 4. Sound effects -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">{{ $t('settings.soundEffects') }}</span>
              <span class="setting-desc">{{ $t('settings.soundEffectsDesc') }}</span>
            </div>
            <div class="setting-control">
              <input
                type="checkbox"
                class="sound-checkbox"
                :checked="settings.soundEffects"
                @change="settings.soundEffects = ($event.target as HTMLInputElement).checked"
              />
              <span class="toggle-state">{{ settings.soundEffects ? $t('common.on') : $t('common.off') }}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="dialog-footer">
          <button class="dialog-btn dialog-btn-close" @click="emit('close')">
            {{ $t('common.close') }}
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
  color: var(--text-primary);
  flex-shrink: 0;
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
}
.setting-row-top {
  padding-bottom: 4px;
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

/* ---- Language select ---- */
.setting-select {
  padding: 6px 10px;
  background: var(--bg-input);
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
}
.setting-select:focus {
  border-color: var(--accent, #4fc3f7);
}

/* ---- Sound checkbox ---- */
.sound-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent, #4fc3f7);
}

/* ---- Coming soon tag ---- */
.coming-soon-tag {
  font-size: 10px;
  color: var(--accent, #4fc3f7);
  background: color-mix(in srgb, var(--accent, #4fc3f7) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent, #4fc3f7) 25%, transparent);
  border-radius: 4px;
  padding: 1px 8px;
  white-space: nowrap;
  font-weight: 500;
}

/* ---- Accent presets ---- */
.accent-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 20px 4px;
}

.accent-preset-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  transition: background 0.15s;
  font-family: inherit;
}

.accent-preset-btn:hover {
  background: var(--bg-hover);
}

.accent-preset-btn.active {
  background: var(--bg-hover-strong);
}

.accent-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  transition: border-color 0.15s, transform 0.15s;
}

.accent-preset-btn.active .accent-swatch {
  border-color: var(--text-primary);
  transform: scale(1.12);
}

.accent-check {
  color: #fff;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.accent-name {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
}

.accent-preset-btn.active .accent-name {
  color: var(--text-primary);
}

/* ---- Custom color row ---- */
.accent-custom-row {
  border-bottom: 1px solid var(--border-soft);
}

.custom-color-input {
  width: 32px;
  height: 28px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  cursor: pointer;
  padding: 2px;
  background: none;
}

.custom-color-input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.custom-color-input::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.custom-hex-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-family: monospace;
  font-weight: 500;
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
  border-color: var(--accent, #4fc3f7);
}

.theme-icon {
  flex-shrink: 0;
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
  color: var(--text-muted);
  flex-shrink: 0;
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
  background: var(--btn-primary-bg, #3498db);
  color: #fff;
}
.dialog-btn-close:hover {
  background: var(--btn-primary-hover, #2980b9);
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
