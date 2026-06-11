import { createApp } from 'vue'
import './theme/variables.css'
import './style.css'
import './composables/useSettings' // 初始化主题色 + 明暗主题（FOUC 防护）
import App from './App.vue'

createApp(App).mount('#app')
