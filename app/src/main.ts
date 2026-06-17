import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from './i18n'
import './styles/tailwind.css'
import 'animate.css'
import { initSettingsStore } from './stores/settings'
import { initShortcutStore } from './stores/shortcuts'
import App from './App.vue'

// 必须在 Vue 挂载前创建 Pinia 并初始化设置（FOUC 防护）
const pinia = createPinia()
initSettingsStore(pinia)   // 立即应用主题/强调色到 DOM，防止白屏闪烁
initShortcutStore(pinia)   // 加载快捷键配置，供全局 keydown 处理

const app = createApp(App)
app.use(pinia)
app.use(i18n)
app.mount('#app')
