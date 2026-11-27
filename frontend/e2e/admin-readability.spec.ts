import { expect, test } from '@playwright/test'

test('admin text and layout stay readable across tabs and screen sizes', async ({ page }) => {
  const propId = '6b002a5c3c49f74ff7188de8'
  const locationId = '6afebf6344bf850bfc30a250'
  await page.addInitScript(() => sessionStorage.setItem('rekvisit-register.access-token', 'test-token'))
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: {
    userId: '0123456789abcdef01234567', firstName: 'Ada', lastName: 'Lovelace',
    userName: 'ada', email: 'ada@example.dk', emailVerified: true,
    role: 'associationAdmin', associationId: 'fedcba9876543210fedcba98', associationName: 'Teater',
  } } }))
  await page.route('**/api/associations/current', (route) => route.fulfill({ json: { association: {
    name: 'Teater', contactPerson: { name: 'Ada', email: 'ada@example.dk', phone: '12345678' },
    storageLocations: [{ id: locationId, address: 'Teatervej 1', postalCode: '6700', city: 'Esbjerg' }],
  } } }))
  await page.route('**/api/associations/current/users', (route) => route.fulfill({ json: { users: [] } }))
  await page.route('**/api/associations/current/loans', (route) => route.fulfill({ json: { loans: [{
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa', type: 'loan', propName: 'Kuffert', associationName: 'Ejer',
    startDate: '2026-11-12', endDate: '2026-11-19', status: 'Godkendt',
  }] } }))
  await page.route('**/api/associations/current/props', (route) => route.fulfill({ json: { props: [{
    id: propId, name: 'Træstol', description: 'En stol', storageLocationId: locationId,
    availability: true, dimensions: { height: 90, width: 45, depth: 45, unit: 'cm' },
    quantity: 1, colour: 'Brun', placement: 'Reol', tags: [], condition: 'God', historicalPeriod: '',
  }] } }))
  await page.route(`**/api/associations/current/props/${propId}/reservations`, (route) => route.fulfill({ json: { reservations: [] } }))

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Kontaktoplysninger' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log ud' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generelt' })).toHaveCSS('font-size', '18px')
  await expect(page.getByText('Ada', { exact: true }).first()).toHaveCSS('font-size', '20px')
  const mainWidth = await page.locator('main').evaluate((element) => element.getBoundingClientRect().width)
  expect(mainWidth).toBeGreaterThan(1250)

  await page.getByRole('button', { name: 'Egne rekvisitter', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Log ud' })).toBeVisible()
  await expect(page.getByText('Find foreningens rekvisitter.')).toHaveCSS('font-size', '18px')
  await page.getByRole('button', { name: 'Brugere', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Log ud' })).toBeVisible()
  await expect(page.locator('label[for="user-first-name"]')).toHaveCSS('font-size', '16px')
  await expect(page.locator('#user-first-name')).toHaveCSS('font-size', '18px')
  await page.getByRole('button', { name: 'Lån', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Log ud' })).toBeVisible()
  await expect(page.getByText('Godkendt', { exact: true })).toHaveCSS('font-size', '16px')

  await page.setViewportSize({ width: 375, height: 812 })
  await expect(page.getByText('Godkendt', { exact: true })).toBeVisible()
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    elements: Array.from(document.querySelectorAll('body *'))
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .map((element) => `${element.tagName}.${element.className}`),
  }))
  expect(overflow.width, overflow.elements.join('\n')).toBeLessThanOrEqual(375)
  await page.getByRole('button', { name: 'Generelt' }).click()
  await expect(page.getByRole('heading', { name: 'Kontaktoplysninger' })).toBeVisible()
  const generalOverflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    elements: Array.from(document.querySelectorAll('body *'))
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .map((element) => `${element.tagName}.${element.className}`),
  }))
  expect(generalOverflow.width, generalOverflow.elements.join('\n')).toBeLessThanOrEqual(375)
  await page.getByRole('button', { name: 'Brugere', exact: true }).click()
  await expect(page.locator('#user-first-name')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await page.getByRole('button', { name: 'Egne rekvisitter', exact: true }).click()
  await expect(page.getByText('Træstol', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/admin/props/${propId}`)
  await expect(page.getByRole('heading', { name: 'Træstol' })).toHaveCSS('font-size', '28px')
  await expect(page.getByRole('button', { name: 'Log ud' })).toBeVisible()
  await page.setViewportSize({ width: 375, height: 812 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await page.goto('/admin/props/new')
  await expect(page.getByLabel('Navn', { exact: true })).toHaveCSS('font-size', '18px')
  await expect(page.getByRole('button', { name: 'Log ud' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})
