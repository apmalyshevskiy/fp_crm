import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],

  // путь, по которому сайт открывается на сервере: '/' (корень) или '/contracts/'
  base: '/contracts/',

  // прокси работает ТОЛЬКО в `npm run dev`
  server: {
    proxy: {
      // API FUSIONPOS. auth — Basic-логин для dev (на сервере точка под Basic).
      '/api': {
        target: 'http://139.100.204.216',
        changeOrigin: true,
        auth: 'crm:Fusion2022',
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      // данные по ИНН (egrul.org) — обход CORS в разработке
      '/egrul': {
        target: 'https://egrul.org',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/egrul/, ''),
      },
    },
  },
})
