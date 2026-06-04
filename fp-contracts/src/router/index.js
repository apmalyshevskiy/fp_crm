// src/router/index.js
// Маршруты приложения. Пока две страницы; позже добавим карточку партнёра
// и редактор договора. lazy-import (() => import(...)) — чтобы каждый экран
// грузился отдельным куском, это и есть "по правилам".

import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/partners' },
  {
    path: '/partners',
    name: 'partners',
    component: () => import('../views/PartnersView.vue'),
  },
  {
    path: '/contracts',
    name: 'contracts',
    component: () => import('../views/ContractsView.vue'),
  },
]

export default createRouter({
  // hash-режим (#/partners) — не требует настройки сервера, удобно для деплоя
  history: createWebHashHistory(),
  routes,
})
