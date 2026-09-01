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

test('focuses an owner when one of its repositories is clicked', async ({ page }) => {
  const repository = page.locator(
    '[data-repository-key="LongExampleOrganization/repository-with-a-long-name"]',
  )

  await repository.click()
  await expect(page.locator('.ghc-owner--focus-target')).toHaveAttribute(
    'data-owner', 'LongExampleOrganization',
  )
  await expect(page.locator('.ghc-back')).toBeVisible()
  await expect(page.locator('.ghc-owner[data-owner="AlphaOrg"]')).toHaveClass(
    /ghc-owner--focus-hidden/,
  )
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

test('closes an owner with Escape after focus moves outside the visualization', async ({ page }) => {
  const owner = page.locator('.ghc-owner__focus[data-owner="AlphaOrg"]')
  await owner.click()
  await expect(page.locator('.ghc-back')).toBeVisible()

  await page.evaluate(() => {
    const outside = document.createElement('button')
    outside.textContent = 'Outside visualization'
    document.body.append(outside)
    outside.focus()
  })
  await expect(page.getByRole('button', { name: 'Outside visualization' })).toBeFocused()

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
})

test('matches stable overview and focused-owner visuals', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1100, height: 900 })
  const summaryBox = await page.locator('.ghc-summary').boundingBox()
  expect(summaryBox).not.toBeNull()
  expect(summaryBox!.y + summaryBox!.height).toBeLessThanOrEqual(900)
  await expect(page.locator('.ghc-visualization')).toHaveScreenshot(
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
  await expect(page.locator('.ghc-visualization')).toHaveScreenshot(
    'ecosystem-owner-focused.png',
    { animations: 'disabled', maxDiffPixelRatio: 0.03 },
  )
})
