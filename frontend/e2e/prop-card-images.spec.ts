import { expect, test } from '@playwright/test'

test('fills the card image area without distortion or overlap', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('rekvisit-register.access-token', 'test-token')
  })

  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: {
      user: {
        userId: '0123456789abcdef01234567',
        firstName: 'Ada',
        lastName: 'Lovelace',
        userName: 'ada',
        email: 'ada@example.dk',
        emailVerified: true,
        role: 'associationAdmin',
        associationId: 'fedcba9876543210fedcba98',
        associationName: 'Teater',
      },
    },
  }))
  await page.route('**/api/associations/current', (route) => route.fulfill({
    json: { association: { name: 'Teater', contactPerson: null, storageLocations: [] } },
  }))
  await page.route('**/api/associations/current/props', (route) => route.fulfill({
    json: {
      props: [
        {
          id: '6b002a5c3c49f74ff7188de8',
          name: 'Portrætbillede',
          description: 'Beskrivelse af rekvisitten.',
          storageLocationId: '6afebf6344bf850bfc30a250',
          availability: true,
          dimensions: { height: 1, width: 1, depth: 1, unit: 'cm' },
          quantity: 1,
          colour: '',
          placement: '',
          tags: [],
          condition: '',
          historicalPeriod: '',
          imageIds: ['1234567890abcdef12345678'],
        },
        {
          id: '6b002a5c3c49f74ff7188de9',
          name: 'Landskabsbillede',
          description: 'En anden beskrivelse.',
          storageLocationId: '6afebf6344bf850bfc30a250',
          availability: true,
          dimensions: { height: 1, width: 1, depth: 1, unit: 'cm' },
          quantity: 1,
          colour: '',
          placement: '',
          tags: [],
          condition: '',
          historicalPeriod: '',
          imageIds: ['abcdef123456789012345678'],
        },
      ],
    },
  }))
  await page.route('**/api/associations/current/props/*/images/*', (route) => {
    const portrait = route.request().url().includes('1234567890abcdef12345678')
    return route.fulfill({
      contentType: 'image/svg+xml',
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="${portrait ? 600 : 1200}" height="${portrait ? 1200 : 600}"><rect width="100%" height="100%" fill="red"/></svg>`,
    })
  })

  await page.goto('/admin?tab=props')
  for (const name of ['Portrætbillede', 'Landskabsbillede']) {
    const card = page.getByRole('button', { name: `Åbn rekvisit ${name}` })
    const area = card.getByRole('img', { name: `Billedområde for ${name}` })
    const image = area.locator('img')
    await expect(image).toBeVisible()
    await expect.poll(async () => image.evaluate((element) => element.complete)).toBe(true)
    expect(await image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0)
    const areaBox = await area.boundingBox()
    const imageBox = await image.boundingBox()
    const headingBox = await card.locator('h3').boundingBox()
    expect(areaBox).not.toBeNull()
    expect(imageBox).not.toBeNull()
    expect(headingBox).not.toBeNull()
    expect(areaBox!.height).toBe(120)
    expect(imageBox!.x).toBeCloseTo(areaBox!.x, 1)
    expect(imageBox!.y).toBeCloseTo(areaBox!.y, 1)
    expect(imageBox!.width).toBeCloseTo(areaBox!.width, 1)
    expect(imageBox!.height).toBeCloseTo(areaBox!.height, 1)
    await expect(image).toHaveCSS('object-fit', 'cover')
    expect(areaBox!.y + areaBox!.height).toBeLessThanOrEqual(headingBox!.y)
  }
})
