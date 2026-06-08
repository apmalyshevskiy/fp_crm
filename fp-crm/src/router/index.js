// src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
  { path: '/deals',      name: 'deals',      component: () => import('../views/DealsView.vue') },
  { path: '/leads',      name: 'leads',      component: () => import('../views/LeadsView.vue') },
  { path: '/kanban',     name: 'kanban',     component: () => import('../views/KanbanView.vue') },
  { path: '/calendar',   name: 'calendar',   component: () => import('../views/CalendarView.vue') },
  { path: '/quotes',     name: 'quotes',     component: () => import('../views/QuotesView.vue') },
  { path: '/rejections', name: 'rejections', component: () => import('../views/RejectionsView.vue') },
]

export default createRouter({ history: createWebHashHistory(), routes })
