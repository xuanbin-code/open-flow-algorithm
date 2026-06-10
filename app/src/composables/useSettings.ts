import { ref, watch } from 'vue'

// ============================================================
// Types
// ============================================================

export interface AppSettings {
  theme: 'dark' | 'light'
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
        language: typeof parsed.language === 'string' ? parsed.language : 'zh-CN',
        soundEffects: parsed.soundEffects === true,
      }
    }
  } catch {
    // ignore corrupt data
  }
  return { theme: 'dark', language: 'zh-CN', soundEffects: false }
}

function persist(s: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // ignore storage errors
  }
}

// ============================================================
// Theme application
// ============================================================

function applyTheme(theme: 'dark' | 'light') {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

// ============================================================
// Singleton state
// ============================================================

const settings = ref<AppSettings>(load())

// Apply persisted theme immediately (before Vue mounts, prevents FOUC)
applyTheme(settings.value.theme)

// Reactively apply theme changes to DOM
watch(
  () => settings.value.theme,
  (newTheme) => {
    applyTheme(newTheme)
    persist(settings.value)
  },
)

// Persist all settings changes
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
