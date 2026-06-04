import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://139.100.204.216',
        changeOrigin: true,
        auth: 'crm:Fusion2022',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})