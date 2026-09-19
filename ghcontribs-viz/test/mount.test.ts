// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { VisualizationIndex } from '../src/data/types.ts'
import { mountContributionEcosystem } from '../src/mount.ts'
import { ownerLabelText } from '../src/render/ecosystem.ts'
import { validDetails, validIndex } from './fixtures.ts'

function flushPromises(): Promise<unknown> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function richerIndex(): VisualizationIndex {
  const index = structuredClone(validIndex)
  index.owners[0]!.repositories.push({
    key: 'ExampleOrg/secondary',
    name: 'secondary',
    details_path: 'repos/x-iv4gc3lqnrsu64th/x-onswg33omrqxe6i.json',
    contributions: {
      total: { issues: 8, pull_requests: 0, reviews: 0, comments: 0 },
      by_month: {
        '2024-02': { issues: 8, pull_requests: 0, reviews: 0, comments: 0 },
      },
    },
  })
  return index
}

function interactiveIndex(): VisualizationIndex {
  const index = richerIndex()
  index.owners.push({
    owner: 'AnotherOrganizationWithALongName',
    repositories: [{
      key: 'AnotherOrganizationWithALongName/another-long-repository-name',
      name: 'another-long-repository-name',
      details_path: 'repos/x-owner/x-repository.json',
      contributions: {
        total: { issues: 2, pull_requests: 3, reviews: 0, comments: 1 },
        by_month: {
          '2024-02': { issues: 2, pull_requests: 3, reviews: 0, comments: 1 },
        },
      },
    }],
  })
  return index
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('mountContributionEcosystem', () => {
  it('keeps owner-name characters ahead of the ellipsis in narrow labels', () => {
    expect(ownerLabelText('AnotherOrganizationWithALongName', 72)).toBe('Anot…')
    expect(ownerLabelText('ExampleOrg', 80)).toBe('Examp…')
    expect(ownerLabelText('omsf', 80)).toBe('omsf')
  })

  it('renders loading state followed by owners, repositories, and complete counts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(validIndex)))
    const target = document.createElement('div')
    document.body.append(target)

    mountContributionEcosystem(target, { dataUrl: '/index.json' })
    expect(target.textContent).toContain('Loading contribution data')
    await flushPromises()

    expect(target.querySelector('[data-owner="ExampleOrg"]')).not.toBeNull()
    const repository = target.querySelector<HTMLElement>(
      '[data-repository-key="ExampleOrg/example"]',
    )
    expect(repository).not.toBeNull()
    expect(repository?.getAttribute('aria-label')).toContain('1 issues')
    expect(repository?.getAttribute('aria-label')).toContain('1 pull requests')
    expect(repository?.getAttribute('aria-label')).toContain('1 reviews')
    expect(repository?.getAttribute('aria-label')).toContain('1 comments')
    expect(
      target.querySelector('.ghc-ecosystem')?.classList.contains(
        'ghc-ecosystem--layout-ready',
      ),
    ).toBe(true)
    expect(target.querySelector('.ghc-summary')?.textContent).toContain(
      '2024-01 through 2024-02',
    )
    expect(target.querySelectorAll('input[data-contribution-type]:checked')).toHaveLength(4)
    expect(target.querySelector<HTMLInputElement>('input[data-month-bound="from"]')?.value)
      .toBe('0')
    expect(target.querySelector<HTMLInputElement>('input[data-month-bound="through"]')?.value)
      .toBe('1')
  })

  it('synchronizes queued and loaded public filter changes with stable controls', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(validIndex)))
    const target = document.createElement('div')
    document.body.append(target)
    const controller = mountContributionEcosystem(target, { dataUrl: '/index.json' })
    controller.setContributionTypes(['reviews'])
    controller.setMonthRange({ from: '2024-02', through: '2024-02' })
    await flushPromises()

    const from = target.querySelector<HTMLInputElement>('input[data-month-bound="from"]')!
    const through = target.querySelector<HTMLInputElement>(
      'input[data-month-bound="through"]',
    )!
    expect([from.value, through.value]).toEqual(['1', '1'])
    expect(from.getAttribute('aria-valuetext')).toBe('February 2024')
    expect(
      Array.from(target.querySelectorAll<HTMLInputElement>(
        'input[data-contribution-type]:checked',
      )).map((input) => input.dataset.contributionType),
    ).toEqual(['reviews'])
    expect(target.querySelector('.ghc-summary')?.textContent).toContain(
      'No contributions match the active filters',
    )
    const repository = target.querySelector<HTMLElement>('.ghc-repository')!
    expect(repository).not.toBeNull()

    from.focus()
    controller.setContributionTypes(['issues', 'comments'])
    controller.setMonthRange({ from: '2024-01', through: '2024-02' })
    expect(target.querySelector('input[data-month-bound="from"]')).toBe(from)
    expect(document.activeElement).toBe(from)
    expect(from.value).toBe('0')
    expect(target.querySelectorAll('input[data-contribution-type]:checked')).toHaveLength(2)
  })

  it('keeps programmatic filters closed while updating the active trigger state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(validIndex)))
    const target = document.createElement('div')
    document.body.append(target)
    const controller = mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()
    const trigger = target.querySelector<HTMLButtonElement>('.ghc-filter-trigger')!
    const controls = target.querySelector<HTMLElement>('.ghc-controls')!

    expect(controls.hidden).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    controller.setContributionTypes(['issues'])

    expect(controls.hidden).toBe(true)
    expect(trigger.classList.contains('ghc-filter-trigger--active')).toBe(true)
    expect(trigger.getAttribute('aria-label')).toBe('Filters, active')
  })

  it('stacks open filters above details and closes filters first with Escape', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json(validIndex))
      .mockResolvedValueOnce(Response.json(validDetails))
    vi.stubGlobal('fetch', fetcher)
    const target = document.createElement('div')
    document.body.append(target)
    const controller = mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()
    const shell = target.querySelector<HTMLElement>('.ghc-visualization')!
    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
      width: 1200,
      top: 0,
    } as DOMRect)
    const trigger = target.querySelector<HTMLButtonElement>('.ghc-filter-trigger')!
    trigger.click()
    controller.selectRepository('ExampleOrg/example')
    await flushPromises()

    const sidebar = target.querySelector<HTMLElement>('.ghc-sidebar')!
    const controls = target.querySelector<HTMLElement>('.ghc-controls')!
    const details = target.querySelector<HTMLElement>('.ghc-details')!
    expect(sidebar.hidden).toBe(false)
    expect(Array.from(sidebar.children)).toEqual([controls, details])

    controls.querySelector<HTMLInputElement>('input[data-contribution-type]')!.focus()
    controls.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true, cancelable: true,
    }))
    expect(controls.hidden).toBe(true)
    expect(document.activeElement).toBe(trigger)
    expect(target.querySelector('.ghc-details')).toBe(details)
    expect(sidebar.hidden).toBe(false)
  })

  it('applies checkbox and reset controls without removing zero-count repositories', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(validIndex)))
    const target = document.createElement('div')
    document.body.append(target)
    mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()
    const repository = target.querySelector<HTMLElement>('.ghc-repository')!

    for (const input of target.querySelectorAll<HTMLInputElement>(
      'input[data-contribution-type]',
    )) {
      input.checked = false
    }
    target.querySelector<HTMLInputElement>('input[data-contribution-type]')!
      .dispatchEvent(new Event('change', { bubbles: true }))
    expect(target.querySelector('.ghc-summary')?.textContent).toContain(
      'No contributions match the active filters',
    )
    expect(target.querySelector('.ghc-repository')).toBe(repository)
    expect(repository.getAttribute('aria-label')).toContain('0 issues')

    target.querySelector<HTMLInputElement>('input[data-month-bound="from"]')!.value = '1'
    target.querySelector<HTMLInputElement>('input[data-month-bound="from"]')!
      .dispatchEvent(new Event('change', { bubbles: true }))
    expect(target.querySelector<HTMLButtonElement>('[data-action="all-months"]')?.disabled)
      .toBe(false)
    target.querySelector<HTMLButtonElement>('[data-action="all-months"]')!.click()
    expect(target.querySelector<HTMLInputElement>('input[data-month-bound="from"]')?.value)
      .toBe('0')
    expect(target.querySelectorAll('input[data-contribution-type]:checked')).toHaveLength(0)
  })

  it('keeps a multi-month scale usable for an all-empty dataset', async () => {
    const emptyIndex: VisualizationIndex = {
      schema_version: 1,
      user: 'octocat',
      source: { first_month: '2024-01', last_month: '2024-03' },
      owners: [],
    }
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(emptyIndex)))
    const target = document.createElement('div')
    document.body.append(target)
    mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()

    const sliders = Array.from(target.querySelectorAll<HTMLInputElement>(
      'input[data-month-bound]',
    ))
    expect(sliders).toHaveLength(2)
    expect(sliders.every((slider) => !slider.disabled && slider.max === '2')).toBe(true)
    expect(target.querySelector('.ghc-summary')?.textContent).toContain(
      'No contributions match the active filters',
    )
  })

  it('shows equivalent filtered summaries for pointer and keyboard focus', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(interactiveIndex())))
    const target = document.createElement('div')
    document.body.append(target)
    const controller = mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()
    const repository = target.querySelector<HTMLElement>(
      '[data-repository-key="AnotherOrganizationWithALongName/another-long-repository-name"]',
    )!

    repository.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))
    expect(target.querySelector('.ghc-summary')?.textContent).toContain(
      'AnotherOrganizationWithALongName/another-long-repository-name',
    )
    expect(repository.classList).toContain('ghc-repository--active')
    expect(repository.closest('.ghc-owner')?.classList).toContain('ghc-owner--related')

    repository.focus()
    repository.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }))
    expect(target.querySelector('.ghc-summary')?.textContent).toContain(
      'AnotherOrganizationWithALongName/another-long-repository-name',
    )

    controller.setContributionTypes(['pull_requests'])
    controller.setMonthRange({ from: '2024-02', through: '2024-02' })
    const summary = target.querySelector('.ghc-summary')?.textContent
    expect(summary).toContain('2024-02 through 2024-02')
    expect(summary).toContain('pull requests')
    expect(summary).toContain('3')
  })

  it('does not highlight repositories when their owner is active', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(interactiveIndex())))
    const target = document.createElement('div')
    document.body.append(target)
    mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()
    const owner = target.querySelector<HTMLElement>(
      '.ghc-owner__focus[data-owner="ExampleOrg"]',
    )!

    owner.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))

    expect(target.querySelector('.ghc-owner--active')).not.toBeNull()
    expect(target.querySelector('.ghc-repository--active')).toBeNull()
    expect(target.querySelector('.ghc-repository--related')).toBeNull()
    expect(
      target.querySelector('.ghc-ecosystem')?.classList,
    ).not.toContain('ghc-ecosystem--has-active-repository')
  })

  it('uses normal tab stops and restores focus after owner focus', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(interactiveIndex())))
    const target = document.createElement('div')
    document.body.append(target)
    mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()
    const firstOwner = target.querySelector<HTMLElement>(
      '.ghc-owner__focus[data-owner="ExampleOrg"]',
    )!
    const repository = target.querySelector<HTMLElement>(
      '[data-repository-key="ExampleOrg/example"]',
    )!

    expect(firstOwner.tabIndex).toBe(0)
    expect(firstOwner.getAttribute('aria-expanded')).toBe('false')
    expect(repository.tabIndex).toBe(0)
    firstOwner.focus()

    firstOwner.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', bubbles: true,
    }))
    expect(target.querySelector('.ghc-back')).not.toHaveProperty('hidden', true)
    expect(
      target.querySelector('[data-owner="AnotherOrganizationWithALongName"]')
        ?.getAttribute('aria-hidden'),
    ).toBe('true')
    expect(document.activeElement).toBe(firstOwner)
    expect(firstOwner.getAttribute('aria-expanded')).toBe('true')

    firstOwner.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true,
    }))
    expect(target.querySelector<HTMLButtonElement>('.ghc-back')?.hidden).toBe(true)
    expect(document.activeElement).toBe(firstOwner)
    expect(firstOwner.getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps compact owner controls visible to keyboard focus', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(interactiveIndex())))
    const target = document.createElement('div')
    vi.spyOn(target, 'getBoundingClientRect').mockImplementation(
      () => ({ top: 0, width: 16 } as DOMRect),
    )
    document.body.append(target)
    mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()

    const owner = target.querySelector<HTMLButtonElement>(
      '.ghc-owner__focus[data-owner="ExampleOrg"]',
    )!
    const label = owner.querySelector<HTMLElement>('.ghc-owner__label')!
    expect(label.classList).toContain('ghc-owner__label--hidden')
    expect(owner.closest('.ghc-owner__name')?.classList).not.toContain(
      'ghc-visually-hidden',
    )
    expect(owner.tabIndex).toBe(0)
    owner.focus()
    expect(document.activeElement).toBe(owner)
  })

  it('scopes Escape handling to the visualization containing focus', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(interactiveIndex())))
    const firstTarget = document.createElement('div')
    const secondTarget = document.createElement('div')
    document.body.append(firstTarget, secondTarget)
    mountContributionEcosystem(firstTarget, { dataUrl: '/first-index.json' })
    mountContributionEcosystem(secondTarget, { dataUrl: '/second-index.json' })
    await flushPromises()
    const firstOwner = firstTarget.querySelector<HTMLElement>(
      '.ghc-owner__focus[data-owner="ExampleOrg"]',
    )!
    const secondOwner = secondTarget.querySelector<HTMLElement>(
      '.ghc-owner__focus[data-owner="ExampleOrg"]',
    )!

    firstOwner.click()
    secondOwner.click()
    const firstBack = firstTarget.querySelector<HTMLButtonElement>('.ghc-back')!
    const secondBack = secondTarget.querySelector<HTMLButtonElement>('.ghc-back')!
    expect(firstBack.hidden).toBe(false)
    expect(secondBack.hidden).toBe(false)
    firstBack.focus()

    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true, cancelable: true,
    })
    firstBack.dispatchEvent(escapeEvent)

    expect(escapeEvent.defaultPrevented).toBe(true)
    expect(firstBack.hidden).toBe(true)
    expect(secondBack.hidden).toBe(false)
    expect(document.activeElement).toBe(firstOwner)
  })

  it('closes programmatically selected repository details with Escape', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json(validIndex))
      .mockResolvedValueOnce(Response.json(validDetails))
    vi.stubGlobal('fetch', fetcher)
    const target = document.createElement('div')
    document.body.append(target)
    const controller = mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()

    controller.selectRepository('ExampleOrg/example')
    await flushPromises()
    expect(target.querySelector('.ghc-owner--focus-target')).toBeNull()
    const close = target.querySelector<HTMLButtonElement>('.ghc-details__close')!
    close.focus()
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true, cancelable: true,
    })
    close.dispatchEvent(escapeEvent)

    expect(escapeEvent.defaultPrevented).toBe(true)
    expect(target.querySelector('.ghc-details')).toBeNull()
  })

  it('focuses the repository owner and opens details on activation', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json(interactiveIndex()))
      .mockResolvedValueOnce(Response.json(validDetails))
    vi.stubGlobal('fetch', fetcher)
    const target = document.createElement('div')
    document.body.append(target)
    mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()
    const repository = target.querySelector<HTMLElement>(
      '[data-repository-key="ExampleOrg/example"]',
    )!
    const measure = vi.spyOn(target, 'getBoundingClientRect')

    expect(repository.getAttribute('role')).toBe('button')
    repository.click()
    expect(measure).toHaveBeenCalledOnce()
    expect(target.querySelector('.ghc-owner--focus-target')?.getAttribute('data-owner'))
      .toBe('ExampleOrg')
    expect(target.querySelector('.ghc-details__title')?.textContent).toBe('ExampleOrg/example')
    expect(target.querySelector('.ghc-details__content')?.textContent).toContain('Loading')
    await flushPromises()
    expect(target.querySelectorAll('.ghc-details__item')).toHaveLength(4)

    repository.dispatchEvent(new KeyboardEvent('keydown', {
      key: ' ', bubbles: true, cancelable: true,
    }))
    expect(target.querySelectorAll('.ghc-details__item')).toHaveLength(4)
    expect(fetcher).toHaveBeenCalledTimes(2)

    target.querySelector<HTMLButtonElement>('.ghc-back')!.click()
    expect(target.querySelector('.ghc-owner--focus-target')).toBeNull()
    expect(target.querySelector('.ghc-details')).toBeNull()
  })

  it('renders all variants in order and reapplies filters from cached details', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json(validIndex))
      .mockResolvedValueOnce(Response.json(validDetails))
    vi.stubGlobal('fetch', fetcher)
    const target = document.createElement('div')
    document.body.append(target)
    const controller = mountContributionEcosystem(target, { dataUrl: '/data/index.json' })
    await flushPromises()
    controller.selectRepository('ExampleOrg/example')
    await flushPromises()
    expect(Array.from(target.querySelectorAll('.ghc-details__type')).map((item) => item.textContent))
      .toEqual(['Issue', 'Pull request', 'Review', 'Comment'])
    expect(target.querySelector('.ghc-details__item:nth-child(3) a')?.textContent)
      .toContain('PR #2 A pull request')
    expect(target.querySelector('.ghc-details__item:nth-child(4) a')?.textContent)
      .toContain('Issue #1 An issue')
    controller.setContributionTypes(['reviews'])
    expect(target.querySelectorAll('.ghc-details__item')).toHaveLength(1)
    controller.setMonthRange({ from: '2024-02', through: '2024-02' })
    expect(target.querySelector('.ghc-details__content')?.textContent)
      .toContain('No contributions match')
    expect(target.querySelector('.ghc-details')).not.toBeNull()
    controller.selectRepository(null)
    controller.selectRepository('ExampleOrg/example')
    await flushPromises()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('filters detail timestamps by their UTC month without refetching', async () => {
    const details = structuredClone(validDetails)
    details.contributions[0]!.created = '2024-02-01T00:30:00+02:00'
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json(validIndex))
      .mockResolvedValueOnce(Response.json(details))
    vi.stubGlobal('fetch', fetcher)
    const target = document.createElement('div')
    document.body.append(target)
    const controller = mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()
    controller.selectRepository('ExampleOrg/example')
    await flushPromises()

    controller.setContributionTypes(['issues'])
    controller.setMonthRange({ from: '2024-01', through: '2024-01' })
    expect(target.querySelectorAll('.ghc-details__item')).toHaveLength(1)
    controller.setMonthRange({ from: '2024-02', through: '2024-02' })
    expect(target.querySelector('.ghc-details__content')?.textContent).toContain(
      'No contributions match',
    )
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('applies repository selection requested before the index loads', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json(validIndex))
      .mockResolvedValueOnce(Response.json(validDetails))
    vi.stubGlobal('fetch', fetcher)
    const target = document.createElement('div')
    document.body.append(target)
    const controller = mountContributionEcosystem(target, { dataUrl: '/index.json' })
    controller.selectRepository('ExampleOrg/example')
    await flushPromises()
    expect(target.querySelector('.ghc-details__title')?.textContent).toBe('ExampleOrg/example')
    controller.selectRepository(null)
    window.dispatchEvent(new Event('resize'))
    await flushPromises()
    expect(target.querySelector('.ghc-details')).toBeNull()
  })

  it('shows retryable failure and ignores an obsolete response', async () => {
    let resolveFirst!: (response: Response) => void
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json(richerIndex()))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json(validDetails))
    vi.stubGlobal('fetch', fetcher)
    const target = document.createElement('div')
    document.body.append(target)
    const controller = mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()
    controller.selectRepository('ExampleOrg/example')
    controller.selectRepository('ExampleOrg/secondary')
    await flushPromises()
    expect(target.querySelector('.ghc-details__content')?.textContent).toContain('503')
    resolveFirst(Response.json(validDetails))
    await flushPromises()
    expect(target.querySelector('.ghc-details__title')?.textContent).toBe('ExampleOrg/secondary')
    controller.selectRepository('ExampleOrg/example')
    await flushPromises()
    expect(target.querySelectorAll('.ghc-details__item')).toHaveLength(4)
  })

  it('retries a failed detail request and restores focus on close', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json(validIndex))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json(validDetails))
    vi.stubGlobal('fetch', fetcher)
    const target = document.createElement('div')
    document.body.append(target)
    mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()
    const tile = target.querySelector<HTMLElement>('.ghc-repository')!
    tile.focus()
    tile.click()
    await flushPromises()
    expect(target.querySelector('[role="alert"]')?.textContent).toContain('503')
    target.querySelector<HTMLButtonElement>('[data-action="retry-details"]')!.click()
    await flushPromises()
    expect(target.querySelectorAll('.ghc-details__item')).toHaveLength(4)
    const close = target.querySelector<HTMLButtonElement>('.ghc-details__close')!
    close.focus()
    close.click()
    expect(target.querySelector('.ghc-details')).toBeNull()
    expect(document.activeElement).toBe(tile)
  })

  it('ignores a detail response after destruction', async () => {
    let resolveDetails!: (response: Response) => void
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json(validIndex))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveDetails = resolve }))
    vi.stubGlobal('fetch', fetcher)
    const target = document.createElement('div')
    document.body.append(target)
    const controller = mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()
    controller.selectRepository('ExampleOrg/example')
    controller.destroy()
    resolveDetails(Response.json(validDetails))
    await flushPromises()
    expect(target.childElementCount).toBe(0)
  })

  it('supports pending and loaded semantic owner focus with unknown owners ignored', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(interactiveIndex())))
    const target = document.createElement('div')
    const controller = mountContributionEcosystem(target, { dataUrl: '/index.json' })
    controller.focusOwner('ExampleOrg')
    await flushPromises()

    expect(target.querySelector('[data-owner="ExampleOrg"]')?.classList).toContain(
      'ghc-owner--focus-target',
    )
    controller.focusOwner('MissingOwner')
    expect(target.querySelector('[data-owner="ExampleOrg"]')?.classList).toContain(
      'ghc-owner--focus-target',
    )
    controller.focusOwner(null)
    expect(target.querySelector('.ghc-owner--focus-target')).toBeNull()
  })

  it('applies pending and loaded controller changes and rerenders geometry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(richerIndex())))
    const target = document.createElement('div')
    const controller = mountContributionEcosystem(target, { dataUrl: '/index.json' })
    controller.setSizeMode('equal')
    await flushPromises()

    const first = target.querySelector<HTMLElement>(
      '[data-repository-key="ExampleOrg/example"]',
    )!
    const second = target.querySelector<HTMLElement>(
      '[data-repository-key="ExampleOrg/secondary"]',
    )!
    const firstNode = first
    expect(first.style.width).toBe(second.style.width)

    controller.setContributionTypes(['comments'])
    expect(
      target
        .querySelector('[data-repository-key="ExampleOrg/secondary"]')
        ?.getAttribute('aria-label'),
    ).toContain('0 issues')

    controller.setMonthRange({ from: '2024-02', through: '2024-02' })
    expect(
      target
        .querySelector('[data-repository-key="ExampleOrg/example"]')
        ?.getAttribute('aria-label'),
    ).toContain('0 comments')
    expect(
      target.querySelector('[data-repository-key="ExampleOrg/example"]'),
    ).toBe(firstNode)
  })

  it('supports independent built-in and custom weighting through the mount API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(richerIndex())))
    const target = document.createElement('div')
    const controller = mountContributionEcosystem(target, {
      dataUrl: '/index.json',
      ownerContributionWeighting: 'log',
      repositoryContributionWeighting: 'linear',
    })
    controller.setRepositoryContributionWeighting(() => 1)
    await flushPromises()

    const first = target.querySelector<HTMLElement>(
      '[data-repository-key="ExampleOrg/example"]',
    )!
    const second = target.querySelector<HTMLElement>(
      '[data-repository-key="ExampleOrg/secondary"]',
    )!
    expect(first.style.width).toBe(second.style.width)

    controller.setOwnerContributionWeighting('asinh')
    expect(
      target.querySelector('[data-repository-key="ExampleOrg/example"]'),
    ).toBe(first)
  })

  it('measures responsive layout, coalesces resize work, and disconnects cleanly', async () => {
    let width = 1200
    let resizeCallback!: ResizeObserverCallback
    const observe = vi.fn()
    const disconnect = vi.fn()
    class ResizeObserverStub {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }
      observe = observe
      disconnect = disconnect
      unobserve = vi.fn()
    }
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(richerIndex())))

    const target = document.createElement('div')
    vi.spyOn(target, 'getBoundingClientRect').mockImplementation(
      () => ({ top: 0, width } as DOMRect),
    )
    const controller = mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()
    const repository = target.querySelector(
      '[data-repository-key="ExampleOrg/example"]',
    )
    expect(target.querySelector<HTMLElement>('.ghc-ecosystem')?.style.height).toBe(
      '608px',
    )
    expect(observe).toHaveBeenCalledWith(target)

    width = 390
    resizeCallback([], {} as ResizeObserver)
    resizeCallback([], {} as ResizeObserver)
    expect(frames).toHaveLength(1)
    frames.shift()!(0)
    expect(target.querySelector<HTMLElement>('.ghc-ecosystem')?.style.height).toBe(
      '320px',
    )
    expect(
      target.querySelector('[data-repository-key="ExampleOrg/example"]'),
    ).toBe(repository)

    controller.destroy()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('renders an actionable load error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404, statusText: 'Not Found' })),
    )
    const target = document.createElement('div')
    mountContributionEcosystem(target, { dataUrl: '/missing.json' })
    await flushPromises()
    expect(target.querySelector('[role="alert"]')?.textContent).toContain(
      'could not be loaded',
    )
    expect(target.textContent).toContain('404 Not Found')
  })

  it('destroys generated DOM and ignores a late fetch result', async () => {
    let resolveResponse!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveResponse = resolve
          }),
      ),
    )
    const target = document.createElement('div')
    const controller = mountContributionEcosystem(target, { dataUrl: '/index.json' })
    controller.destroy()
    expect(target.childElementCount).toBe(0)

    resolveResponse(Response.json(validIndex))
    await flushPromises()
    expect(target.childElementCount).toBe(0)
  })

  it('rejects invalid month ranges synchronously', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const controller = mountContributionEcosystem(document.createElement('div'), {
      dataUrl: '/index.json',
    })
    expect(() =>
      controller.setMonthRange({ from: '2024-03', through: '2024-02' }),
    ).toThrow('must not be after')
  })
})
