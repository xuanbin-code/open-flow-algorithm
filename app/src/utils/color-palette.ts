// ============================================================
// 主题色调色板工具
// ============================================================

import { i18n } from '../i18n'
const t = i18n.global.t

export interface AccentPreset {
  id: string
  name: string
  dark: string   // 深色主题下的 hex
  light: string  // 浅色主题下的 hex
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'blue',    name: t('colorPresets.blue'), dark: '#4fc3f7', light: '#1976d2' },
  { id: 'emerald', name: t('colorPresets.emerald'), dark: '#2ecc71', light: '#27ae60' },
  { id: 'coral',   name: t('colorPresets.coral'), dark: '#e74c3c', light: '#c0392b' },
  { id: 'orange',  name: t('colorPresets.orange'), dark: '#e67e22', light: '#d35400' },
  { id: 'violet',  name: t('colorPresets.violet'), dark: '#9b59b6', light: '#8e44ad' },
  { id: 'teal',    name: t('colorPresets.teal'), dark: '#1abc9c', light: '#16a085' },
  { id: 'amber',   name: t('colorPresets.amber'), dark: '#f39c12', light: '#e67e22' },
  { id: 'rose',    name: t('colorPresets.rose'), dark: '#e91e63', light: '#c2185b' },
]

// ============================================================
// 颜色转换工具
// ============================================================

interface HSL {
  h: number
  s: number
  l: number
}

/** hex → HSL */
export function hexToHsl(hex: string): HSL {
  let r = 0, g = 0, b = 0
  const h = hex.replace('#', '')
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16) / 255
    g = parseInt(h[1] + h[1], 16) / 255
    b = parseInt(h[2] + h[2], 16) / 255
  } else {
    r = parseInt(h.substring(0, 2), 16) / 255
    g = parseInt(h.substring(2, 4), 16) / 255
    b = parseInt(h.substring(4, 6), 16) / 255
  }
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let hh = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: hh = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: hh = ((b - r) / d + 2) / 6; break
      case b: hh = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: Math.round(hh * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

/** HSL → hex */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** 调整 hex 颜色的亮度 */
export function adjustLightness(hex: string, deltaPercent: number): string {
  const { h, s, l } = hexToHsl(hex)
  const newL = Math.max(5, Math.min(95, l + deltaPercent))
  return hslToHex(h, s, newL)
}

/** hex → rgba 字符串 */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  let r: number, g: number, b: number
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16)
    g = parseInt(h[1] + h[1], 16)
    b = parseInt(h[2] + h[2], 16)
  } else {
    r = parseInt(h.substring(0, 2), 16)
    g = parseInt(h.substring(2, 4), 16)
    b = parseInt(h.substring(4, 6), 16)
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ============================================================
// 颜色亮度计算（用于自动选择前景色）
// ============================================================

/** 计算 hex 颜色的相对亮度 (WCAG 2.0) */
export function getRelativeLuminance(hex: string): number {
  const h = hex.replace('#', '')
  let r: number, g: number, b: number
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16) / 255
    g = parseInt(h[1] + h[1], 16) / 255
    b = parseInt(h[2] + h[2], 16) / 255
  } else {
    r = parseInt(h.substring(0, 2), 16) / 255
    g = parseInt(h.substring(2, 4), 16) / 255
    b = parseInt(h.substring(4, 6), 16) / 255
  }
  const linearize = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/** 根据背景色亮度返回合适的前景色（白 / 深色） */
export function getContrastForeground(bgHex: string): string {
  return getRelativeLuminance(bgHex) > 0.5 ? '#071311' : '#ffffff'
}

// ============================================================
// 调色板生成
// ============================================================

export interface AccentPalette {
  '--accent': string
  '--accent-foreground': string
  '--accent-blue': string
  '--primary': string
  '--primary-foreground': string
  '--ring': string
  '--btn-primary-bg': string
  '--btn-primary-hover': string
  '--bubble-program-bg': string
  '--bubble-program-border': string
  '--bg-speed-active': string
}

/**
 * 根据 accentColor 值和当前 theme 生成完整调色板
 * 同时覆盖项目特有变量与 shadcn-vue 语义 CSS 变量，
 * 确保 shadcn 组件（Button、focus ring 等）与用户所选主题色一致。
 *
 * @param accentColor - preset id 或 '#hex' 值
 * @param theme - 当前明暗主题
 */
export function generateAccentPalette(accentColor: string, theme: 'dark' | 'light'): AccentPalette {
  let baseHex: string

  // 判断是预设 id 还是自定义 hex
  const preset = ACCENT_PRESETS.find(p => p.id === accentColor)
  if (preset) {
    baseHex = theme === 'dark' ? preset.dark : preset.light
  } else if (accentColor.startsWith('#')) {
    // 自定义颜色：根据主题调整亮度
    baseHex = theme === 'dark'
      ? adjustLightness(accentColor, 15)   // 深色下提亮
      : adjustLightness(accentColor, -10)  // 浅色下压暗
  } else {
    // 未知值，回退到默认蓝色
    baseHex = theme === 'dark' ? '#4fc3f7' : '#1976d2'
  }

  const hoverHex = theme === 'dark'
    ? adjustLightness(baseHex, -12)
    : adjustLightness(baseHex, -8)

  const foreground = getContrastForeground(baseHex)

  return {
    // ---- 项目特有 ----
    '--accent': baseHex,
    '--accent-foreground': foreground,
    '--accent-blue': baseHex,
    '--btn-primary-bg': baseHex,
    '--btn-primary-hover': hoverHex,
    '--bubble-program-bg': hexToRgba(baseHex, 0.15),
    '--bubble-program-border': hexToRgba(baseHex, 0.30),
    '--bg-speed-active': hexToRgba(baseHex, 0.20),
    // ---- shadcn-vue 语义变量 ----
    '--primary': baseHex,
    '--primary-foreground': foreground,
    '--ring': baseHex,
  }
}
