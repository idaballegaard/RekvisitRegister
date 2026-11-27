import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.vue'
import { clearAuthSession, getCurrentUser } from '../services/auth.service'

async function setRole(role: 'associationAdmin' | 'propManager' | 'searchUser') {
  sessionStorage.setItem('rekvisit-register.access-token', 'test-token')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    user: {
      userId: '0123456789abcdef01234567', firstName: 'Ada', lastName: 'Lovelace',
      userName: 'ada', email: 'ada@example.dk', emailVerified: true, role,
      associationId: 'fedcba9876543210fedcba98', associationName: 'Teater',
    },
  }), { status: 200 })))
  await getCurrentUser()
}

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
  beforeEach(clearAuthSession)
  afterEach(() => {
    clearAuthSession()
    vi.unstubAllGlobals()
  })

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
    await setRole('associationAdmin')
    const { wrapper } = await mountAt(path)
    const nav = wrapper.get('[aria-label="Hovednavigation"]')
    expect(nav.get('[aria-current="page"]').text()).toBe(active)
    expect(nav.get('a[href="/profile"]').text()).toBe('Profil')
    expect(nav.get('a[href="/admin"]').text()).toBe('Adminpanel')
    expect(nav.findAll('[aria-disabled="true"]').map((item) => item.text()))
      .toEqual(['Rekvisitter', 'Teaterforeninger'])
  })

  it.each([
    ['associationAdmin', true],
    ['propManager', true],
    ['searchUser', false],
  ] as const)('shows the admin link according to the %s role', async (role, visible) => {
    await setRole(role)
    const { wrapper } = await mountAt('/profile')
    expect(wrapper.find('a[href="/admin"]').exists()).toBe(visible)
    expect(wrapper.get('a[href="/profile"]').text()).toBe('Profil')
  })

  it('opens and closes the mobile menu and restores focus on Escape', async () => {
    await setRole('associationAdmin')
    const { wrapper } = await mountAt('/profile')
    const button = wrapper.get('button[aria-controls="site-navigation-links"]')
    expect(button.attributes('aria-expanded')).toBe('false')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(button.attributes('aria-label')).toBe('Luk menu')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(button.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('clears the role on logout and does not restore it from an earlier response', async () => {
    await setRole('associationAdmin')
    const { wrapper } = await mountAt('/profile')
    expect(wrapper.find('a[href="/admin"]').exists()).toBe(true)
    let respond!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>((resolve) => { respond = resolve })))
    const request = getCurrentUser()
    clearAuthSession()
    respond(new Response(JSON.stringify({ user: {
      userId: '0123456789abcdef01234567', firstName: 'Ada', lastName: 'Lovelace',
      userName: 'ada', email: 'ada@example.dk', emailVerified: true, role: 'associationAdmin',
      associationId: 'fedcba9876543210fedcba98', associationName: 'Teater',
    } }), { status: 200 }))
    await request
    await wrapper.vm.$nextTick()
    expect(wrapper.find('a[href="/admin"]').exists()).toBe(false)
    await setRole('searchUser')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('a[href="/admin"]').exists()).toBe(false)
  })
})
