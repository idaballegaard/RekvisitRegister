import { expect, test } from '@playwright/test'

test('navigation works on authenticated pages and fits desktop and mobile', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('rekvisit-register.access-token', 'test-token'))
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: {
    userId: '0123456789abcdef01234567', firstName: 'Ada', lastName: 'Lovelace',
    userName: 'ada', email: 'ada@example.dk', emailVerified: true,
    role: 'associationAdmin', associationId: 'fedcba9876543210fedcba98', associationName: 'Teater',
  } } }))
  await page.route('**/api/associations/current', (route) => route.fulfill({ json: { association: {
    name: 'Teater', contactPerson: { name: 'Ada', email: 'ada@example.dk', phone: '12345678' },
    storageLocations: [],
  } } }))

  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/profile')
  const nav = page.getByRole('navigation', { name: 'Hovednavigation' })
  await expect(nav.getByText('Rekvisit Register')).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Profil' })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByText('Rekvisitter', { exact: true })).toHaveAttribute('aria-disabled', 'true')
  await expect(nav.getByText('Teaterforeninger')).toHaveAttribute('aria-disabled', 'true')
  await nav.getByRole('link', { name: 'Adminpanel' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(nav.getByRole('link', { name: 'Adminpanel' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: 'Kontaktoplysninger' })).toBeVisible()

  for (const width of [320, 375, 700, 701, 800, 1024]) {
    await page.setViewportSize({ width, height: 812 })
    await expect(nav.getByRole('link', { name: 'Profil' })).toBeVisible()
    const navigationRight = await nav.evaluate((element) => Math.max(
      ...Array.from(element.querySelectorAll('*'), (child) => child.getBoundingClientRect().right),
    ))
    expect(navigationRight).toBeLessThanOrEqual(width)
    if (width >= 375) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    }
  }
  await nav.getByRole('link', { name: 'Profil' }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await page.getByRole('button', { name: 'Log ud' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(nav).toHaveCount(0)
})
