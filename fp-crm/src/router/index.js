// src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'

const Stub = () => import('../views/StubView.vue')

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
  { path: '/deals',      name: 'deals',      component: () => import('../views/DealsView.vue') },
  { path: '/leads',      name: 'leads',      component: Stub, meta: { title: 'Лиды' } },
  { path: '/kanban',     name: 'kanban',     component: Stub, meta: { title: 'Канбан' } },
  { path: '/calendar',   name: 'calendar',   component: Stub, meta: { title: 'Календарь' } },
  { path: '/quotes',     name: 'quotes',     component: Stub, meta: { title: 'Цитаты боли' } },
  { path: '/rejections', name: 'rejections', component: Stub, meta: { title: 'Отказы' } },
]

export default createRouter({ history: createWebHashHistory(), routes })
