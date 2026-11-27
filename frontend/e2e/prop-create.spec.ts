import { expect, test } from '@playwright/test'

test('creates a prop and opens its detail page', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('rekvisit-register.access-token', 'test-token')
  })
  const locationId = '6afebf6344bf850bfc30a250'
  const propId = '6b002a5c3c49f74ff7188de8'
  const imageId = '1234567890abcdef12345678'
  let created: Record<string, unknown> | undefined
  let uploaded = false
  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: {
      user: {
        userId: '0123456789abcdef01234567', firstName: 'Ada', lastName: 'Lovelace',
        userName: 'ada', email: 'ada@example.dk', emailVerified: true,
        role: 'associationAdmin', associationId: 'fedcba9876543210fedcba98',
        associationName: 'Teater',
      },
    },
  }))
  await page.route('**/api/associations/current', (route) => route.fulfill({
    json: {
      association: {
        name: 'Teater', contactPerson: null,
        storageLocations: [{ id: locationId, address: 'Teatervej 1', postalCode: '6700', city: 'Esbjerg' }],
      },
    },
  }))
  await page.route('**/api/associations/current/props', async (route) => {
    if (route.request().method() === 'POST') {
      created = { ...route.request().postDataJSON(), id: propId }
      await route.fulfill({ status: 201, json: { prop: created } })
    } else {
      await route.fulfill({ json: { props: created ? [created] : [] } })
    }
  })
  await page.route(`**/api/associations/current/props/${propId}/images`, async (route) => {
    uploaded = true
    if (created) created.imageIds = [imageId]
    await route.fulfill({ status: 201, json: { imageId } })
  })
  await page.route(`**/api/associations/current/props/${propId}/images/${imageId}`, (route) => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
  }))
  await page.route(`**/api/associations/current/props/${propId}/reservations`, (route) => route.fulfill({
    json: { reservations: [] },
  }))

  await page.goto('/admin?tab=props')
  await page.getByRole('button', { name: 'Tilføj rekvisit' }).click()
  await expect(page).toHaveURL(/\/admin\/props\/new$/)
  await page.getByLabel('Navn', { exact: true }).fill('En ny rekvisit')
  await page.getByLabel('Beskrivelse').fill('En beskrivelse')
  await page.getByLabel('Højde').fill('20')
  await page.getByLabel('Bredde').fill('30')
  await page.getByLabel('Dybde').fill('40')
  await page.getByLabel('Lageradresse').selectOption(locationId)
  await page.getByLabel('Tilføj billeder').setInputFiles({
    name: 'rekvisit.png',
    mimeType: 'image/png',
    buffer: Buffer.from('image'),
  })
  await expect(page.getByLabel('Valgte billeder')).toContainText('rekvisit.png')
  expect(uploaded).toBe(false)
  await page.getByRole('button', { name: 'Opret rekvisit' }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/props/${propId}$`))
  await expect(page.getByRole('heading', { name: 'En ny rekvisit' })).toBeVisible()
  expect(uploaded).toBe(true)
  await expect(page.getByRole('img', { name: 'Billede af En ny rekvisit' })).toBeVisible()
  await page.getByRole('button', { name: 'Redigér' }).click()
  await expect(page.getByLabel('Tilføj billede')).toBeAttached()
})
