// ============================================================
// Settings Store — 集中管理所有持久化设置
// 提供 FOUC 防护：在首次访问 store 时立即应用主题/强调色
// ============================================================

import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { generateAccentPalette } from '../lib/colorPalette'
import { setI18nLocale } from '../i18n'

// ============================================================
// Types
// ============================================================

export interface AppSettings {
  theme: 'dark' | 'light'
  accentColor: string
  language: string
  soundEffects: boolean
  defaultZoom: number
  yOffset: number
}

// ============================================================
// localStorage persistence
// ============================================================

const STORAGE_KEY = 'flowgorithm-settings'

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        theme: parsed.theme === 'light' ? 'light' : 'dark',
        accentColor: typeof parsed.accentColor === 'string' && parsed.accentColor.length > 0
          ? parsed.accentColor
          : 'blue',
        language: typeof parsed.language === 'string' ? parsed.language : 'zh-CN',
        soundEffects: parsed.soundEffects === true,
        defaultZoom: typeof parsed.defaultZoom === 'number' && parsed.defaultZoom >= 0.1 && parsed.defaultZoom <= 4.0
          ? parsed.defaultZoom : 0.9,
        yOffset: typeof parsed.yOffset === 'number' && parsed.yOffset >= 0
          ? parsed.yOffset : 30,
      }
    }
  } catch {
    // ignore corrupt data
  }
  return { theme: 'dark', accentColor: 'blue', language: 'zh-CN', soundEffects: false, defaultZoom: 0.9, yOffset: 30 }
}

function persist(s: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // ignore storage errors
  }
}

// ============================================================
// Theme / accent DOM helpers
// ============================================================

function applyTheme(theme: 'dark' | 'light') {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

function applyAccentColor(accentColor: string, theme: 'dark' | 'light') {
  const palette = generateAccentPalette(accentColor, theme)
  const root = document.documentElement
  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(key, value)
  }
}

// ============================================================
// Store
// ============================================================

let earlyStore: ReturnType<typeof useSettingsStore> | null = null

export const useSettingsStore = defineStore('settings', () => {
  // ── State ──
  const theme = ref<'dark' | 'light'>('dark')
  const accentColor = ref('blue')
  const language = ref('zh-CN')
  const soundEffects = ref(false)
  const defaultZoom = ref(0.9)
  const yOffset = ref(30)

  // ── Init from localStorage ──
  const saved = load()
  theme.value = saved.theme
  accentColor.value = saved.accentColor
  language.value = saved.language
  soundEffects.value = saved.soundEffects
  defaultZoom.value = saved.defaultZoom
  yOffset.value = saved.yOffset

  // ── FOUC 防护：store 首次创建时立即应用到 DOM ──
  applyTheme(theme.value)
  applyAccentColor(accentColor.value, theme.value)

  // ── 持久化 ──
  function persistAll() {
    persist({
      theme: theme.value,
      accentColor: accentColor.value,
      language: language.value,
      soundEffects: soundEffects.value,
      defaultZoom: defaultZoom.value,
      yOffset: yOffset.value,
    })
  }

  // ── 响应式同步到 DOM / i18n ──
  watch(theme, (newTheme) => {
    applyTheme(newTheme)
    applyAccentColor(accentColor.value, newTheme)
    persistAll()
  })

  watch(accentColor, (newAccent) => {
    applyAccentColor(newAccent, theme.value)
    persistAll()
  })

  watch([language, soundEffects, defaultZoom, yOffset], () => {
    persistAll()
  })

  watch(language, (newLang) => {
    setI18nLocale(newLang)
    window.dispatchEvent(new CustomEvent('language-changed', { detail: newLang }))
  })

  return { theme, accentColor, language, soundEffects, defaultZoom, yOffset }
})

/**
 * 在 Pinia 挂载前预先访问 store 以触发 FOUC 防护。
 * 调用方负责传入有效的 Pinia 实例。
 */
export function initSettingsStore(pinia: ReturnType<typeof import('pinia').createPinia>) {
  earlyStore = useSettingsStore(pinia)
  return earlyStore
}
