// src/main.js
// Точка входа. Создаём приложение, подключаем роутер, монтируем в #app.
// Vite сам сгенерирует этот файл при создании проекта — замени его на этот.

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

createApp(App)
  .use(router)
  .mount('#app')
