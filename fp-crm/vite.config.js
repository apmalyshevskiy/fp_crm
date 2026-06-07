import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],

  // путь, по которому сайт будет лежать на сервере (отдельно от старой CRM и договоров)
  //   подпапка http://139.../crm/ -> base: '/crm/'
  base: '/crm/',

  // прокси только для `npm run dev`
  server: {
    proxy: {
      '/api': {
        target: 'http://139.100.204.216',
        changeOrigin: true,
        auth: 'crm:Fusion2022',          // Basic для dev (та точка на сервере под Basic)
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      // егрюл для автозаполнения по ИНН (src/lib/inn/egrul.js ходит на /egrul/<инн>.json)
      '/egrul': {
        target: 'https://egrul.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/egrul/, ''),
      },
    },
  },
})
