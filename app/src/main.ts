import { createApp } from 'vue'
import { i18n } from './i18n'
import './theme/variables.css'
import './style.css'
import './composables/useSettings' // 初始化主题色 + 明暗主题（FOUC 防护）
import App from './App.vue'

const app = createApp(App)
app.use(i18n)
app.mount('#app')
