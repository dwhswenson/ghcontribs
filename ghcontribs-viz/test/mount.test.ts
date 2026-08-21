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
      () => ({ width } as DOMRect),
    )
    const controller = mountContributionEcosystem(target, { dataUrl: '/index.json' })
    await flushPromises()
    const repository = target.querySelector(
      '[data-repository-key="ExampleOrg/example"]',
    )
    expect(target.querySelector<HTMLElement>('.ghc-ecosystem')?.style.height).toBe(
      '800px',
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
