import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.ghc-ecosystem--layout-ready')).toBeVisible()
})

test('shows equivalent repository detail for pointer and keyboard focus', async ({ page }) => {
  const repository = page.locator(
    '[data-repository-key="LongExampleOrganization/repository-with-a-long-name"]',
  )
  const summary = page.locator('.ghc-summary')

  await repository.hover()
  await expect(summary).toContainText(
    'LongExampleOrganization/repository-with-a-long-name',
  )
  await expect(repository).toHaveClass(/ghc-repository--active/)

  await repository.focus()
  await page.mouse.move(0, 0)
  await expect(summary).toContainText(
    'LongExampleOrganization/repository-with-a-long-name',
  )
  await expect(summary).toContainText('2024-01 through 2024-02')
})

test('opens repository details when a repository is clicked', async ({ page }) => {
  const repository = page.locator(
    '[data-repository-key="LongExampleOrganization/repository-with-a-long-name"]',
  )

  await repository.click()
  await expect(page.locator('.ghc-details__title')).toHaveText(
    'LongExampleOrganization/repository-with-a-long-name',
  )
  await expect(page.locator('.ghc-details__item')).toHaveCount(4)
  await expect(page.locator('.ghc-owner--focus-target')).toHaveCount(0)
  await page.locator('.ghc-details__close').click()
  await expect(page.locator('.ghc-details')).toHaveCount(0)
})

test('opens details with keyboard and supports retry', async ({ page }) => {
  const repository = page.locator(
    '[data-repository-key="LongExampleOrganization/repository-with-a-long-name"]',
  )
  let attempts = 0
  await page.route('**/repos/x-jrxw4z2fpbqw24dmmvhxez3bnzuxuylunfxw4/*.json', async (route) => {
    attempts += 1
    if (attempts === 1) await route.fulfill({ status: 503, body: 'Unavailable' })
    else await route.continue()
  })
  await repository.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.ghc-details [role="alert"]')).toContainText('503')
  await page.locator('[data-action="retry-details"]').click()
  await expect(page.locator('.ghc-details__item')).toHaveCount(4)
  expect(attempts).toBe(2)
})

test('focuses an owner and restores focus on exit', async ({ page }) => {
  const owner = page.locator('.ghc-owner__focus[data-owner="AlphaOrg"]')
  await owner.focus()

  await page.keyboard.press('Enter')
  await expect(page.locator('.ghc-back')).toBeVisible()
  await expect(page.locator('.ghc-owner--focus-target')).toHaveAttribute(
    'data-owner', 'AlphaOrg',
  )
  const hiddenOwner = page.locator('.ghc-owner--focus-hidden')
  await expect(hiddenOwner).toHaveAttribute(
    'aria-hidden', 'true',
  )
  await expect(hiddenOwner).toHaveCSS('opacity', '0')
  await expect(owner).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.locator('.ghc-back')).toBeHidden()
  await expect(owner).toBeFocused()
})

test('respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.ghc-ecosystem')).toHaveCSS(
    '--ghc-layout-duration', '0ms',
  )
})

test('keeps the ecosystem and summary usable on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const ecosystem = page.locator('.ghc-ecosystem')
  const summary = page.locator('.ghc-summary')
  await expect(ecosystem).toBeVisible()
  expect((await ecosystem.boundingBox())?.width).toBeLessThanOrEqual(390)
  const summaryColumns = await summary.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  )
  expect(summaryColumns.split(' ')).toHaveLength(1)

  await page.locator('.ghc-owner__focus[data-owner="AlphaOrg"]').click()
  const focusedOwner = page.locator('.ghc-owner--focus-target')
  await expect(focusedOwner).toBeVisible()
  await expect.poll(async () => (await focusedOwner.boundingBox())?.width ?? 0)
    .toBeGreaterThan(300)

  await page.locator('[data-repository-key="AlphaOrg/large-project"]').click()
  await expect(page.locator('.ghc-details')).toBeVisible()
  expect((await page.locator('.ghc-details').boundingBox())?.width).toBeLessThanOrEqual(390)
})

test('matches stable overview and focused-owner visuals', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1100, height: 900 })
  const visualization = page.locator('.ghc-visualization')
  await visualization.evaluate((element) => {
    element.style.position = 'absolute'
    element.style.inset = '0 auto auto 0'
    element.style.width = '1068px'
    element.style.height = '648px'
  })
  const summaryBox = await page.locator('.ghc-summary').boundingBox()
  expect(summaryBox).not.toBeNull()
  expect(summaryBox!.y + summaryBox!.height).toBeLessThanOrEqual(900)
  await expect(visualization).toHaveScreenshot(
    'ecosystem-overview.png',
    { animations: 'disabled', maxDiffPixelRatio: 0.03 },
  )

  await page.locator('.ghc-owner__focus[data-owner="AlphaOrg"]').click()
  await expect(page.locator('.ghc-owner--focus-target')).toHaveAttribute(
    'data-owner', 'AlphaOrg',
  )
  await expect(page.locator('.ghc-summary__title')).toHaveText('AlphaOrg')
  await expect(page.locator('.ghc-back')).toHaveText('Back to overview')
  const focusedOwnerName = page.locator(
    '.ghc-owner--focus-target > .ghc-owner__name',
  )
  await expect(focusedOwnerName).not.toHaveClass(/ghc-visually-hidden/)
  expect((await focusedOwnerName.boundingBox())?.width).toBeGreaterThan(100)
  expect((await focusedOwnerName.locator('.ghc-owner__focus').boundingBox())?.width)
    .toBeGreaterThan(50)
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
  await expect(visualization).toHaveScreenshot(
    'ecosystem-owner-focused.png',
    { animations: 'disabled', maxDiffPixelRatio: 0.03 },
  )
})
