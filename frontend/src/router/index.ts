import { createRouter, createWebHistory } from 'vue-router'
import { hasAccessToken } from '../services/auth.service'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !hasAccessToken()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router
