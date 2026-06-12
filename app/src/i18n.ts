// ============================================================
// i18n.ts — vue-i18n 实例配置
//
// 创建 i18n 实例供 Vue SFC（useI18n()）和纯 TS 引擎文件
//（导入 i18n.global.t）使用。
// ============================================================

import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN.json'
import en from './locales/en.json'

function getInitialLocale(): string {
  try {
    const raw = localStorage.getItem('flowgorithm-settings')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.language === 'zh-CN' || parsed.language === 'en') {
        return parsed.language
      }
    }
  } catch {
    /* corrupt data — fall back to default */
  }
  return 'zh-CN'
}

export const i18n = createI18n({
  legacy: false, // Composition API 模式
  locale: getInitialLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    en,
  },
})

/** 运行时切换 locale（由 useSettings watcher 调用） */
export function setI18nLocale(locale: string): void {
  ;(i18n.global.locale as any).value = locale
  document.documentElement.lang = locale === 'zh-CN' ? 'zh-CN' : 'en'
}
