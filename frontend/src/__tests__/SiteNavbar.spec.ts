import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import App from '../App.vue'

async function mountAt(path: string) {
  const component = { template: '<main>Side</main>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'login', component },
      { path: '/profile', name: 'profile', component, meta: { requiresAuth: true } },
      { path: '/admin', name: 'admin', component, meta: { requiresAuth: true } },
      { path: '/admin/props/new', name: 'admin-prop-create', component, meta: { requiresAuth: true } },
      { path: '/admin/props/:propId', name: 'admin-prop-detail', component, meta: { requiresAuth: true } },
    ],
  })
  await router.push(path)
  await router.isReady()
  return { wrapper: mount(App, { global: { plugins: [router] } }), router }
}

describe('site navigation', () => {
  it('is hidden on login and shown on authenticated pages', async () => {
    const { wrapper, router } = await mountAt('/')
    expect(wrapper.find('[aria-label="Hovednavigation"]').exists()).toBe(false)
    await router.push('/profile')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[aria-label="Hovednavigation"]').exists()).toBe(true)
    await router.push('/')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[aria-label="Hovednavigation"]').exists()).toBe(false)
  })

  it.each([
    ['/profile', 'Profil'],
    ['/admin', 'Adminpanel'],
    ['/admin/props/new', 'Adminpanel'],
    ['/admin/props/123', 'Adminpanel'],
  ])('marks the correct navigation link on %s', async (path, active) => {
    const { wrapper } = await mountAt(path)
    const nav = wrapper.get('[aria-label="Hovednavigation"]')
    expect(nav.get('[aria-current="page"]').text()).toBe(active)
    expect(nav.get('a[href="/profile"]').text()).toBe('Profil')
    expect(nav.get('a[href="/admin"]').text()).toBe('Adminpanel')
    expect(nav.findAll('[aria-disabled="true"]').map((item) => item.text()))
      .toEqual(['Rekvisitter', 'Teaterforeninger'])
  })
})
