import { beforeEach, describe, expect, it } from 'vitest'
import router from '../router'
import { clearAuthSession } from '../services/auth.service'

describe('router authentication guard', () => {
  beforeEach(async () => {
    clearAuthSession()
    await router.push('/')
  })

  it('redirects to login when the profile has no access token', async () => {
    await router.push('/profile')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/profile')
  })

  it('allows profile navigation when an access token is present', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'test-token')
    await router.push('/profile')

    expect(router.currentRoute.value.name).toBe('profile')
  })
})
