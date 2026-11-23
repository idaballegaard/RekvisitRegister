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

  it('redirects to login when the admin panel has no access token', async () => {
    await router.push('/admin')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/admin')
  })

  it('redirects to login when a prop detail has no access token', async () => {
    await router.push('/admin/props/6b002a5c3c49f74ff7188de8')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect)
      .toBe('/admin/props/6b002a5c3c49f74ff7188de8')
  })

  it('redirects to login when creating a prop without a token', async () => {
    await router.push('/admin/props/new')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/admin/props/new')
  })

  it('routes prop creation separately from prop details', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'test-token')
    await router.push('/admin/props/new')
    expect(router.currentRoute.value.name).toBe('admin-prop-create')
  })

  it('allows profile navigation when an access token is present', async () => {
    sessionStorage.setItem('rekvisit-register.access-token', 'test-token')
    await router.push('/profile')

    expect(router.currentRoute.value.name).toBe('profile')
  })
})
