import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.ghc-ecosystem--layout-ready')).toBeVisible()
})

test('keeps owner-name characters in every visible label', async ({ page }) => {
  const labels = page.locator(
    '.ghc-owner__label:not(.ghc-owner__label--hidden)',
  )
  const labelTexts = await labels.allTextContents()

  expect(labelTexts.length).toBeGreaterThan(0)
  for (const label of labelTexts) expect(label).toMatch(/[A-Za-z0-9]/)

  const hiddenLabels = page.locator('.ghc-owner__label--hidden')
  for (const label of await hiddenLabels.all()) {
    await expect(label).toHaveCSS('display', 'none')
  }
})

test('draws owner keyboard focus only around the outer owner region', async ({ page }) => {
  const control = page.locator('.ghc-owner__focus').filter({ visible: true }).first()
  const owner = control.locator('xpath=ancestor::section[contains(@class, "ghc-owner")]')

  await control.focus()
  await expect(control).toBeFocused()
  await expect(control).toHaveCSS('outline-style', 'none')
  await expect(owner).toHaveCSS('outline-style', 'solid')
  await expect(owner).toHaveCSS('outline-width', '3px')
})

async function openFilters(page: import('@playwright/test').Page): Promise<void> {
  const trigger = page.locator('.ghc-filter-trigger')
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click()
  await expect(page.locator('.ghc-controls')).toBeVisible()
}

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
  await expect(summary).toContainText('2013-01 through 2026-08')
})

test('filters contribution types and an inclusive range across a year boundary', async ({ page }) => {
  await openFilters(page)
  const summary = page.locator('.ghc-summary')
  const summaryMeta = page.locator('.ghc-summary__meta')
  const from = page.locator('input[data-month-bound="from"]')
  const through = page.locator('input[data-month-bound="through"]')
  const checkboxes = page.locator('input[data-contribution-type]')
  const typeControls = page.locator('.ghc-type-control')
  const typeTops = await typeControls.evaluateAll((controls) =>
    controls.map((control) => control.getBoundingClientRect().top),
  )
  expect(new Set(typeTops).size).toBe(1)
  const rangeBox = await page.locator('.ghc-dual-range').boundingBox()
  const resetBox = await page.getByRole('button', { name: 'All months' }).boundingBox()
  expect(rangeBox).not.toBeNull()
  expect(resetBox).not.toBeNull()
  expect(resetBox!.x).toBeGreaterThanOrEqual(rangeBox!.x + rangeBox!.width)

  for (let index = 0; index < await checkboxes.count(); index += 1) {
    const checkbox = checkboxes.nth(index)
    if (await checkbox.getAttribute('data-contribution-type') !== 'issues') {
      await checkbox.uncheck()
    }
  }
  await through.evaluate((element: HTMLInputElement) => {
    element.value = '132'
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await from.evaluate((element: HTMLInputElement) => {
    element.value = '131'
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })

  await expect(from).toHaveAttribute('aria-valuetext', 'December 2023')
  await expect(through).toHaveAttribute('aria-valuetext', 'January 2024')
  await expect(summary).toContainText('2023-12 through 2024-01')
  await expect(summaryMeta).toContainText('issues')
  await expect(summaryMeta).not.toContainText('pull requests')

  await from.focus()
  await page.keyboard.press('ArrowRight')
  await expect(from).toBeFocused()
  await expect(from).toHaveAttribute('aria-valuetext', 'January 2024')
  await expect(summary).toContainText('2024-01 through 2024-01')

  await page.getByRole('button', { name: 'All months' }).click()
  await expect(summary).toContainText('2013-01 through 2026-08')
  await expect(page.locator('input[data-contribution-type="pull_requests"]')).not.toBeChecked()
})

test('keeps a selected repository open and cached while filters change', async ({ page }) => {
  let detailRequests = 0
  await page.route('**/repos/x-jrxw4z2fpbqw24dmmvhxez3bnzuxuylunfxw4/*.json', async (route) => {
    detailRequests += 1
    await route.continue()
  })
  await page.locator(
    '[data-repository-key="LongExampleOrganization/repository-with-a-long-name"]',
  ).click()
  await expect(page.locator('.ghc-details__item')).toHaveCount(4)
  await openFilters(page)

  const issue = page.locator('input[data-contribution-type="issues"]')
  const pullRequest = page.locator('input[data-contribution-type="pull_requests"]')
  const review = page.locator('input[data-contribution-type="reviews"]')
  const comment = page.locator('input[data-contribution-type="comments"]')
  await issue.uncheck()
  await pullRequest.uncheck()
  await comment.uncheck()
  await expect(page.locator('.ghc-details__item')).toHaveCount(1)
  await review.uncheck()
  await expect(page.locator('.ghc-details')).toBeVisible()
  await expect(page.locator('.ghc-details__content')).toContainText(
    'No contributions match the active filters',
  )
  await expect(page.locator('.ghc-summary')).toContainText(
    'No contributions match the active filters',
  )
  expect(detailRequests).toBe(1)
})

test('supports touch input on the native month range', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  })
  const touchPage = await context.newPage()
  await touchPage.goto('/')
  await expect(touchPage.locator('.ghc-ecosystem--layout-ready')).toBeVisible()
  await openFilters(touchPage)
  const from = touchPage.locator('input[data-month-bound="from"]')
  const box = await from.boundingBox()
  expect(box).not.toBeNull()
  await touchPage.touchscreen.tap(box!.x + box!.width * 0.2, box!.y + box!.height / 2)
  await expect(from).not.toHaveValue('0')
  await context.close()
})

test('supports pointer dragging on the shared month track', async ({ page }) => {
  await openFilters(page)
  const from = page.locator('input[data-month-bound="from"]')
  const box = await from.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + 9, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width * 0.25, box!.y + box!.height / 2, {
    steps: 5,
  })
  await page.mouse.up()
  await expect(from).not.toHaveValue('0')
  await expect(from).toBeFocused()
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
  await expect(page.locator('.ghc-owner--focus-target')).toHaveAttribute(
    'data-owner', 'LongExampleOrganization',
  )
  await page.locator('.ghc-details__close').click()
  await expect(page.locator('.ghc-details')).toHaveCount(0)
  await expect(page.locator('.ghc-owner--focus-target')).toHaveAttribute(
    'data-owner', 'LongExampleOrganization',
  )
})

test('back to overview also closes repository details', async ({ page }) => {
  const repository = page.locator(
    '[data-repository-key="LongExampleOrganization/repository-with-a-long-name"]',
  )
  await repository.click()
  await expect(page.locator('.ghc-details')).toBeVisible()
  await page.locator('.ghc-back').click()
  await expect(page.locator('.ghc-details')).toHaveCount(0)
  await expect(page.locator('.ghc-owner--focus-target')).toHaveCount(0)
})

test('keeps ecosystem geometry stable as repository details finish loading', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 })
  await page.route('**/repos/x-jrxw4z2fpbqw24dmmvhxez3bnzuxuylunfxw4/*.json', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    await route.continue()
  })
  await page.locator(
    '[data-repository-key="LongExampleOrganization/repository-with-a-long-name"]',
  ).click()
  await expect(page.locator('.ghc-details__content')).toContainText('Loading')
  const loadingHeight = await page.locator('.ghc-ecosystem').evaluate(
    (element) => element.getBoundingClientRect().height,
  )
  await expect(page.locator('.ghc-details__item')).toHaveCount(4)
  const loadedHeight = await page.locator('.ghc-ecosystem').evaluate(
    (element) => element.getBoundingClientRect().height,
  )
  expect(loadedHeight).toBeCloseTo(loadingHeight, 0)
})

test('places the sidebar beside the ecosystem only when the mount is wide enough', async ({ page }) => {
  const repository = page.locator(
    '[data-repository-key="LongExampleOrganization/repository-with-a-long-name"]',
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await repository.click()
  const ecosystem = page.locator('.ghc-ecosystem')
  const details = page.locator('.ghc-details')
  await expect(details).toBeVisible()
  const wideEcosystem = await ecosystem.boundingBox()
  const wideDetails = await details.boundingBox()
  expect(wideEcosystem).not.toBeNull()
  expect(wideDetails).not.toBeNull()
  expect(wideDetails!.x).toBeGreaterThan(wideEcosystem!.x + wideEcosystem!.width)
  expect(Math.abs(wideDetails!.y - wideEcosystem!.y)).toBeLessThan(2)

  await page.setViewportSize({ width: 700, height: 900 })
  const narrowSummary = await page.locator('.ghc-summary').boundingBox()
  const narrowDetails = await details.boundingBox()
  expect(narrowSummary).not.toBeNull()
  expect(narrowDetails).not.toBeNull()
  expect(narrowDetails!.y).toBeGreaterThanOrEqual(narrowSummary!.y + narrowSummary!.height)
})

test('stacks filters above details and closes filters first with Escape', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.locator(
    '[data-repository-key="LongExampleOrganization/repository-with-a-long-name"]',
  ).click()
  await expect(page.locator('.ghc-details__item')).toHaveCount(4)

  const controls = page.locator('.ghc-controls')
  const details = page.locator('.ghc-details')
  const ecosystem = page.locator('.ghc-ecosystem')
  const summary = page.locator('.ghc-summary')
  const sidebar = page.locator('.ghc-sidebar')
  const ecosystemBefore = await ecosystem.boundingBox()
  const summaryBefore = await summary.boundingBox()
  const sidebarBefore = await sidebar.boundingBox()
  const detailsBefore = await details.boundingBox()

  await openFilters(page)

  const controlsBox = await controls.boundingBox()
  const detailsBox = await details.boundingBox()
  const ecosystemBox = await ecosystem.boundingBox()
  const summaryBox = await summary.boundingBox()
  const sidebarBox = await sidebar.boundingBox()
  expect(controlsBox).not.toBeNull()
  expect(detailsBox).not.toBeNull()
  expect(ecosystemBox).not.toBeNull()
  expect(summaryBox).not.toBeNull()
  expect(sidebarBox).not.toBeNull()
  expect(ecosystemBefore).not.toBeNull()
  expect(summaryBefore).not.toBeNull()
  expect(sidebarBefore).not.toBeNull()
  expect(detailsBefore).not.toBeNull()
  expect(ecosystemBox).toEqual(ecosystemBefore)
  expect(summaryBox).toEqual(summaryBefore)
  expect(sidebarBox).toEqual(sidebarBefore)
  expect(detailsBox!.height).toBeLessThan(detailsBefore!.height)
  expect(await details.evaluate((panel) => panel.getAnimations().length)).toBe(0)
  expect(await page.locator('.ghc-details__list').evaluate(
    (list) => list.scrollHeight > list.clientHeight,
  )).toBe(true)
  expect(detailsBox!.y).toBeGreaterThanOrEqual(controlsBox!.y + controlsBox!.height)
  expect(controlsBox!.x).toBeGreaterThan(ecosystemBox!.x + ecosystemBox!.width)

  await controls.locator('input[data-contribution-type]').first().focus()
  await page.keyboard.press('Escape')
  await expect(controls).toBeHidden()
  await expect(details).toBeVisible()
  await expect(page.locator('.ghc-filter-trigger')).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(details).toHaveCount(0)
})

test('animates detail resizing when filters open and close', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.locator(
    '[data-repository-key="LongExampleOrganization/repository-with-a-long-name"]',
  ).click()
  await expect(page.locator('.ghc-details__item')).toHaveCount(4)
  const details = page.locator('.ghc-details')
  const expandedHeight = (await details.boundingBox())!.height

  await page.locator('.ghc-filter-trigger').click()
  expect(await details.evaluate((panel) => panel.getAnimations().length)).toBe(1)
  await details.evaluate(async (panel) => {
    await Promise.all(panel.getAnimations().map((animation) => animation.finished))
  })
  const compactHeight = (await details.boundingBox())!.height
  expect(compactHeight).toBeLessThan(expandedHeight)

  await page.locator('.ghc-controls__close').click()
  expect(await details.evaluate((panel) => panel.getAnimations().length)).toBe(1)
  await details.evaluate(async (panel) => {
    await Promise.all(panel.getAnimations().map((animation) => animation.finished))
  })
  expect((await details.boundingBox())!.height).toBeCloseTo(expandedHeight, 0)
})

test('keeps an open filter panel inline across the mobile breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openFilters(page)
  const controls = page.locator('.ghc-controls')
  const ecosystem = page.locator('.ghc-ecosystem')
  const wideControls = await controls.boundingBox()
  const wideEcosystem = await ecosystem.boundingBox()
  expect(wideControls).not.toBeNull()
  expect(wideEcosystem).not.toBeNull()
  expect(wideControls!.x).toBeGreaterThan(wideEcosystem!.x + wideEcosystem!.width)

  await page.setViewportSize({ width: 700, height: 900 })
  await expect(page.locator('.ghc-filter-trigger')).toHaveAttribute('aria-expanded', 'true')
  const narrowToolbar = await page.locator('.ghc-toolbar').boundingBox()
  const narrowControls = await controls.boundingBox()
  const narrowEcosystem = await ecosystem.boundingBox()
  expect(narrowToolbar).not.toBeNull()
  expect(narrowControls).not.toBeNull()
  expect(narrowEcosystem).not.toBeNull()
  expect(narrowControls!.y).toBeGreaterThanOrEqual(narrowToolbar!.y + narrowToolbar!.height)
  expect(narrowEcosystem!.y).toBeGreaterThanOrEqual(narrowControls!.y + narrowControls!.height)
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
  await page.locator('input[data-month-bound="from"]').evaluate(
    (element: HTMLInputElement) => {
      element.value = '132'
      element.dispatchEvent(new Event('change', { bubbles: true }))
    },
  )
  await expect(page.locator('.ghc-summary')).toContainText(
    '2024-01 through 2026-08',
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
    element.style.background = '#03090f'
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

test('matches responsive filter and detail panel visuals', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1100, height: 900 })
  const visualization = page.locator('.ghc-visualization')
  await visualization.evaluate((element) => {
    element.style.position = 'absolute'
    element.style.inset = '0 auto auto 0'
    element.style.width = '1068px'
    element.style.background = '#03090f'
  })

  await openFilters(page)
  await expect(visualization).toHaveScreenshot(
    'ecosystem-filters-open.png',
    { animations: 'disabled', maxDiffPixelRatio: 0.03 },
  )

  await page.locator(
    '[data-repository-key="LongExampleOrganization/repository-with-a-long-name"]',
  ).click()
  await expect(page.locator('.ghc-details__item')).toHaveCount(4)
  await expect(visualization).toHaveScreenshot(
    'ecosystem-filters-and-details.png',
    { animations: 'disabled', maxDiffPixelRatio: 0.03 },
  )

  await page.locator('.ghc-controls__close').click()
  await expect(visualization).toHaveScreenshot(
    'ecosystem-details-open.png',
    { animations: 'disabled', maxDiffPixelRatio: 0.03 },
  )

  await page.locator('.ghc-details__close').click()
  await page.setViewportSize({ width: 390, height: 844 })
  await visualization.evaluate((element) => {
    element.style.position = ''
    element.style.inset = ''
    element.style.width = ''
  })
  await openFilters(page)
  await expect(visualization).toHaveScreenshot(
    'ecosystem-mobile-filters-open.png',
    { animations: 'disabled', maxDiffPixelRatio: 0.03 },
  )
})
