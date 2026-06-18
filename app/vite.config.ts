import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isWeb = mode === 'web' || mode === 'gh-pages'

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    // 桌面端：Tauri 需要固定端口 1420；Web 端：使用 Vite 默认端口 5173
    server: isWeb
      ? {
          port: 5173,
          open: true,
        }
      : {
          host: host || '127.0.0.1',
          port: 1420,
          strictPort: true,
          hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
          watch: {
            ignored: ['**/src-tauri/**'],
          },
        },
    // 输出目录 + base 路径
    //   - Tauri 模式 → dist/
    //   - Web 模式   → dist-web/，base = '/'
    //   - gh-pages 模式 → dist-web/，base = '/open-flow-algorithm/'
    build: {
      outDir: isWeb ? 'dist-web' : 'dist',
    },
    base: mode === 'gh-pages' ? '/open-flow-algorithm/' : '/',
  }
})
