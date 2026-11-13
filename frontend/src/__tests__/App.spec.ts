import { afterEach, describe, it, expect, vi } from 'vitest'

import { mount } from '@vue/test-utils'
import LoginView from '../views/LoginView.vue'

describe('LoginView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
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

  it('submits username and password to the backend and stores the access token', async () => {
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
      expect(wrapper.text()).toContain('Du er logget ind som ada.l.')
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
