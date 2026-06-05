// src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/partners' },
  { path: '/partners', name: 'partners', component: () => import('../views/PartnersView.vue') },
  { path: '/partners/:id', name: 'partner', component: () => import('../views/PartnerCard.vue') },
  { path: '/contracts', name: 'contracts', component: () => import('../views/ContractsView.vue') },
  { path: '/contracts/new', name: 'contract-new', component: () => import('../views/ContractBuilder.vue') },
  // правка черновика — тот же конструктор, но с id
  { path: '/contracts/:id/edit', name: 'contract-edit', component: () => import('../views/ContractBuilder.vue') },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
