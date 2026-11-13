import { afterEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LoginView from '../views/LoginView.vue'
import ProfileView from '../views/ProfileView.vue'

const { routerPush, routerReplace } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
}))

const currentUserResponse = {
  user: {
    userId: '0123456789abcdef01234567',
    firstName: 'Ada',
    lastName: 'Lovelace',
    userName: 'ada.l',
    role: 'associationAdmin',
    associationId: 'fedcba9876543210fedcba98',
    associationName: 'Skarntyden',
  },
}

describe('LoginView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    routerPush.mockReset()
    sessionStorage.clear()
  })

  it('renders the login page and its access fields', () => {
    const wrapper = mount(LoginView)

    expect(wrapper.text()).toContain('Velkommen tilbage')
    expect(wrapper.find('label[for="userName"]').text()).toBe('Brugernavn')
    expect(wrapper.get('input[name="userName"]').attributes('type')).toBe('text')
    expect(wrapper.get('input[name="userName"]').attributes('autocomplete')).toBe('username')
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
  })

  it('toggles password visibility', async () => {
    const wrapper = mount(LoginView)

    await wrapper.get('button[aria-label="Vis adgangskode"]').trigger('click')

    expect(wrapper.get('input[name="password"]').attributes('type')).toBe('text')
    expect(wrapper.find('button[aria-label="Skjul adgangskode"]').exists()).toBe(true)
  })

  it('logs in and navigates to the profile', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      tokenType: 'Bearer',
      expiresIn: 900,
      accessToken: 'test-access-token',
      user: {
        userId: '0123456789abcdef01234567',
        firstName: 'Ada',
        lastName: 'Lovelace',
        userName: 'ada.l',
        role: 'associationAdmin',
        associationId: 'fedcba9876543210fedcba98',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(LoginView)

    await wrapper.get('input[name="userName"]').setValue('ada.l')
    await wrapper.get('input[name="password"]').setValue('a-long-passphrase')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith({ name: 'profile' })
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'ada.l', password: 'a-long-passphrase' }),
    })
    expect(sessionStorage.getItem('rekvisit-register.access-token')).toBe('test-access-token')
  })

  it('shows backend login errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'Brugernavn eller adgangskode er forkert' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )))
    const wrapper = mount(LoginView)

    await wrapper.get('input[name="userName"]').setValue('ada.l')
    await wrapper.get('input[name="password"]').setValue('wrong-password')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.get('[role="alert"]').text()).toContain('Brugernavn eller adgangskode er forkert')
    })
    expect(sessionStorage.getItem('rekvisit-register.access-token')).toBeNull()
  })
})

describe('ProfileView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    routerReplace.mockReset()
    sessionStorage.clear()
  })

  it('loads the signed-in user and renders profile information', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify(currentUserResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(ProfileView)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Ada Lovelace')
    })
    expect(wrapper.text()).toContain('Min profil')
    expect(wrapper.text()).toContain('Personlige oplysninger')
    expect(wrapper.text()).toContain('Adgangskode')
    expect(wrapper.text()).toContain('Forening og rolle')
    expect(wrapper.text()).toContain('Skarntyden')
    expect(wrapper.text()).toContain('Foreningsansvarlig')
    expect(wrapper.get('input[name="email"]').attributes('type')).toBe('email')
    expect(wrapper.get('input[name="email"]').attributes('placeholder')).toBe('Ikke angivet')
    expect(wrapper.findAll('input[autocomplete="new-password"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Log ud')
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', {
      headers: { Authorization: 'Bearer current-test-token' },
    })
  })

  it('toggles visibility for the current password', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'current-test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify(currentUserResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    const wrapper = mount(ProfileView)

    await vi.waitFor(() => {
      expect(wrapper.find('button[aria-label="Vis nuværende adgangskode"]').exists()).toBe(true)
    })
    await wrapper.get('button[aria-label="Vis nuværende adgangskode"]').trigger('click')

    expect(wrapper.get('input[name="currentPassword"]').attributes('type')).toBe('text')
    expect(wrapper.find('button[aria-label="Skjul nuværende adgangskode"]').exists()).toBe(true)
  })

  it('clears an invalid session and redirects to login', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'expired-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'Dit login er udløbet.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )))
    mount(ProfileView)

    await vi.waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith({ name: 'login' })
    })
    expect(sessionStorage.getItem('rekvisit-register.access-token')).toBeNull()
  })
})
