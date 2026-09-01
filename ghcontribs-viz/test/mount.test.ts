// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { VisualizationIndex } from '../src/data/types.ts'
import { mountContributionEcosystem } from '../src/mount.ts'
import { validIndex } from './fixtures.ts'

function flushPromises(): Promise<unknown> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function richerIndex(): VisualizationIndex {
  const index = structuredClone(validIndex)
  index.owners[0]!.repositories.push({
    key: 'ExampleOrg/secondary',
    name: 'secondary',
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

  it('closes a focused owner with Escape after focus leaves the visualization', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(interactiveIndex())))
    const target = document.createElement('div')
    const outside = document.createElement('button')
    document.body.append(target, outside)
    mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()
    const owner = target.querySelector<HTMLElement>(
      '.ghc-owner__focus[data-owner="ExampleOrg"]',
    )!

    owner.click()
    outside.focus()
    expect(document.activeElement).toBe(outside)

    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true, cancelable: true,
    })
    outside.dispatchEvent(escapeEvent)

    expect(escapeEvent.defaultPrevented).toBe(true)
    expect(target.querySelector<HTMLButtonElement>('.ghc-back')?.hidden).toBe(true)
    expect(document.activeElement).toBe(owner)
  })

  it('focuses a repository owner when the repository is activated', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(interactiveIndex())))
    const target = document.createElement('div')
    document.body.append(target)
    mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()
    const repository = target.querySelector<HTMLElement>(
      '[data-repository-key="ExampleOrg/example"]',
    )!

    expect(repository.getAttribute('role')).toBe('button')
    repository.click()
    expect(target.querySelector('[data-owner="ExampleOrg"]')?.classList).toContain(
      'ghc-owner--focus-target',
    )
    expect(
      target.querySelector('[data-owner="AnotherOrganizationWithALongName"]')
        ?.getAttribute('aria-hidden'),
    ).toBe('true')

    repository.dispatchEvent(new KeyboardEvent('keydown', {
      key: ' ', bubbles: true, cancelable: true,
    }))
    expect(target.querySelector('[data-owner="ExampleOrg"]')?.classList).toContain(
      'ghc-owner--focus-target',
    )
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
