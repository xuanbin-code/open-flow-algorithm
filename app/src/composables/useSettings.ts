import { ref, watch } from 'vue'
import { generateAccentPalette } from '../utils/color-palette'

// ============================================================
// Types
// ============================================================

export interface AppSettings {
  theme: 'dark' | 'light'
  accentColor: string   // preset id (如 'blue') 或 '#hex' (如 '#ff0000')
  language: string
  soundEffects: boolean
}

// ============================================================
// Storage
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
      }
    }
  } catch {
    // ignore corrupt data
  }
  return { theme: 'dark', accentColor: 'blue', language: 'zh-CN', soundEffects: false }
}

function persist(s: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // ignore storage errors
  }
}

// ============================================================
// Theme application (dark / light)
// ============================================================

function applyTheme(theme: 'dark' | 'light') {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

// ============================================================
// Accent color application
// ============================================================

function applyAccentColor(accentColor: string, theme: 'dark' | 'light') {
  const palette = generateAccentPalette(accentColor, theme)
  const root = document.documentElement
  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(key, value)
  }
}

// ============================================================
// Singleton state
// ============================================================

const settings = ref<AppSettings>(load())

// Apply persisted settings immediately (before Vue mounts, prevents FOUC)
applyTheme(settings.value.theme)
applyAccentColor(settings.value.accentColor, settings.value.theme)

// Reactively apply theme changes to DOM
watch(
  () => settings.value.theme,
  (newTheme) => {
    applyTheme(newTheme)
    // 切换明暗主题时重新计算主题色（亮度自适应）
    applyAccentColor(settings.value.accentColor, newTheme)
    persist(settings.value)
  },
)

// Reactively apply accent color changes
watch(
  () => settings.value.accentColor,
  (newAccent) => {
    applyAccentColor(newAccent, settings.value.theme)
    persist(settings.value)
  },
)

// Persist all other settings changes
watch(
  settings,
  (newVal) => {
    persist(newVal)
  },
  { deep: true },
)

// ============================================================
// Composable
// ============================================================

export function useSettings() {
  return { settings }
}
