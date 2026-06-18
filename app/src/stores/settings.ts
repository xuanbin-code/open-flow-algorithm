// ============================================================
// Settings Store — 集中管理所有持久化设置
// 提供 FOUC 防护：在首次访问 store 时立即应用主题/强调色
// ============================================================

import { ref, watch, computed } from 'vue'
import { defineStore } from 'pinia'
import { useMediaQuery } from '@vueuse/core'
import { generateAccentPalette } from '../lib/colorPalette'
import { setI18nLocale } from '../i18n'

// ============================================================
// Types
// ============================================================

export type ThemeMode = 'dark' | 'light' | 'system'

export interface AppSettings {
  theme: ThemeMode
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

const VALID_THEMES: ThemeMode[] = ['dark', 'light', 'system']

function detectLanguage(): string {
  const lang = (navigator.language || 'en').toLowerCase()
  if (lang.startsWith('zh')) return 'zh-CN'
  return 'en'
}

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        theme: VALID_THEMES.includes(parsed.theme) ? parsed.theme : 'dark',
        accentColor: typeof parsed.accentColor === 'string' && parsed.accentColor.length > 0
          ? parsed.accentColor
          : 'blue',
        language: typeof parsed.language === 'string' ? parsed.language : detectLanguage(),
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
  return { theme: 'dark', accentColor: 'blue', language: detectLanguage(), soundEffects: false, defaultZoom: 0.9, yOffset: 30 }
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

function applyTheme(resolved: 'dark' | 'light') {
  if (resolved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

function applyAccentColor(accentColor: string, resolved: 'dark' | 'light') {
  const palette = generateAccentPalette(accentColor, resolved)
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
  // ── System media query ──
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')

  // ── State ──
  const theme = ref<ThemeMode>('dark')
  const accentColor = ref('blue')
  const language = ref(detectLanguage())
  const soundEffects = ref(false)
  const defaultZoom = ref(0.9)
  const yOffset = ref(30)

  // ── Derived: resolved theme (dark/light, even when theme='system') ──
  const resolvedTheme = computed<'dark' | 'light'>(() => {
    if (theme.value === 'system') {
      return prefersDark.value ? 'dark' : 'light'
    }
    return theme.value
  })

  // ── Init from localStorage ──
  const saved = load()
  theme.value = saved.theme
  accentColor.value = saved.accentColor
  language.value = saved.language
  soundEffects.value = saved.soundEffects
  defaultZoom.value = saved.defaultZoom
  yOffset.value = saved.yOffset

  // ── FOUC 防护：store 首次创建时立即应用到 DOM ──
  applyTheme(resolvedTheme.value)
  applyAccentColor(accentColor.value, resolvedTheme.value)

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
  // Watch resolved theme for DOM application (triggers on theme change OR system preference change)
  watch(resolvedTheme, (newResolved) => {
    applyTheme(newResolved)
    applyAccentColor(accentColor.value, newResolved)
  })

  // Watch raw theme for persistence only
  watch(theme, () => {
    persistAll()
  })

  watch(accentColor, (newAccent) => {
    applyAccentColor(newAccent, resolvedTheme.value)
    persistAll()
  })

  watch([language, soundEffects, defaultZoom, yOffset], () => {
    persistAll()
  })

  watch(language, (newLang) => {
    setI18nLocale(newLang)
    window.dispatchEvent(new CustomEvent('language-changed', { detail: newLang }))
  })

  return { theme, accentColor, language, soundEffects, defaultZoom, yOffset, resolvedTheme }
})

/**
 * 在 Pinia 挂载前预先访问 store 以触发 FOUC 防护。
 * 调用方负责传入有效的 Pinia 实例。
 */
export function initSettingsStore(pinia: ReturnType<typeof import('pinia').createPinia>) {
  earlyStore = useSettingsStore(pinia)
  return earlyStore
}
