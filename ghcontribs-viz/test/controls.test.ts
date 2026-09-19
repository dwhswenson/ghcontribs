// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ContributionType, VisualizationIndex } from '../src/data/types.ts'
import { VisualizationModel, type VisualizationSnapshot } from '../src/model/model.ts'
import type { MonthRange } from '../src/model/months.ts'
import { FilterControls } from '../src/render/controls.ts'
import { validIndex } from './fixtures.ts'

function snapshot(
  source = { first_month: '2023-12', last_month: '2024-03' },
): VisualizationSnapshot {
  const index: VisualizationIndex = structuredClone(validIndex)
  index.source = source
  return new VisualizationModel(index).getSnapshot()
}

function setup(initial = snapshot()) {
  const target = document.createElement('div')
  const trigger = document.createElement('button')
  trigger.className = 'ghc-filter-trigger'
  trigger.dataset.action = 'toggle-filters'
  const container = document.createElement('form')
  container.className = 'ghc-controls'
  target.append(trigger, container)
  document.body.append(target)
  const types: ContributionType[][] = []
  const ranges: MonthRange[] = []
  const visibilityChanges: boolean[] = []
  let controls: FilterControls
  controls = new FilterControls(target, {
    onContributionTypesChange(value) {
      types.push(value)
    },
    onMonthRangeChange(value) {
      ranges.push(value)
    },
    onPanelVisibilityChange() {
      visibilityChanges.push(controls.isOpen)
    },
  })
  controls.update(container, initial)
  return { target, trigger, container, controls, types, ranges, visibilityChanges }
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('FilterControls', () => {
  it('starts closed and toggles with stable accessible trigger semantics', () => {
    const { container, trigger, controls, visibilityChanges } = setup()
    expect(container.hidden).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-controls')).toBe(container.id)

    trigger.click()
    expect(controls.isOpen).toBe(true)
    expect(container.hidden).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(visibilityChanges).toEqual([true])

    container.querySelector<HTMLButtonElement>('[data-action="close-filters"]')!.click()
    expect(controls.isOpen).toBe(false)
    expect(container.hidden).toBe(true)
    expect(document.activeElement).toBe(trigger)
    expect(visibilityChanges).toEqual([true, false])
  })

  it('closes before other Escape handlers and restores trigger focus', () => {
    const { target, container, trigger } = setup()
    const outerKeydown = vi.fn()
    target.addEventListener('keydown', outerKeydown)
    trigger.click()
    container.querySelector<HTMLInputElement>('input[data-contribution-type]')!.focus()

    container.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }))

    expect(container.hidden).toBe(true)
    expect(document.activeElement).toBe(trigger)
    expect(outerKeydown).not.toHaveBeenCalled()
  })

  it('shows active filter state without opening the panel', () => {
    const initial = snapshot()
    const { container, trigger, controls } = setup(initial)
    const model = new VisualizationModel({
      ...structuredClone(validIndex),
      source: { first_month: '2023-12', last_month: '2024-03' },
    })
    model.setContributionTypes(['issues'])
    controls.update(container, model.getSnapshot())

    expect(container.hidden).toBe(true)
    expect(trigger.classList.contains('ghc-filter-trigger--active')).toBe(true)
    expect(trigger.getAttribute('aria-label')).toBe('Filters, active')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('renders all types and the complete source month scale', () => {
    const { container } = setup()
    expect(
      Array.from(container.querySelectorAll('.ghc-type-control span')).map(
        (element) => element.textContent,
      ),
    ).toEqual(['PR', 'Issue', 'Review', 'Comment'])
    expect(
      Array.from(container.querySelectorAll<HTMLInputElement>(
        'input[data-contribution-type]',
      )).every((input) => input.checked),
    ).toBe(true)
    const from = container.querySelector<HTMLInputElement>(
      'input[data-month-bound="from"]',
    )!
    const through = container.querySelector<HTMLInputElement>(
      'input[data-month-bound="through"]',
    )!
    expect([from.min, from.max, from.step, from.value]).toEqual(['0', '3', '1', '0'])
    expect(through.value).toBe('3')
    expect(from.getAttribute('aria-valuetext')).toBe('December 2023')
    expect(through.getAttribute('aria-valuetext')).toBe('March 2024')
    expect(container.querySelector('.ghc-controls__scale')).toBeNull()
    expect(container.querySelector('.ghc-controls__range-row')?.lastElementChild)
      .toBe(container.querySelector('[data-action="all-months"]'))
    expect(Array.from(container.querySelectorAll('.ghc-month-endpoint label')).map(
      (label) => [label.textContent, label.classList.contains('ghc-visually-hidden')],
    )).toEqual([
      ['Start month', true],
      ['End month', true],
    ])
    expect(container.querySelector<HTMLButtonElement>('[data-action="all-months"]')?.disabled)
      .toBe(true)
  })

  it('reports canonical contribution types and permits selecting none', () => {
    const { container, types } = setup()
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>(
      'input[data-contribution-type]',
    ))
    for (const input of inputs) input.checked = false
    inputs[0]!.dispatchEvent(new Event('change', { bubbles: true }))
    expect(types).toEqual([[]])

    inputs.find((input) => input.dataset.contributionType === 'comments')!.checked = true
    inputs.find((input) => input.dataset.contributionType === 'issues')!.checked = true
    inputs[1]!.dispatchEvent(new Event('change', { bubbles: true }))
    expect(types.at(-1)).toEqual(['issues', 'comments'])
  })

  it('updates labels immediately and coalesces range input to one frame', () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const { container, ranges } = setup()
    const from = container.querySelector<HTMLInputElement>(
      'input[data-month-bound="from"]',
    )!

    from.value = '1'
    from.dispatchEvent(new Event('input', { bubbles: true }))
    from.value = '2'
    from.dispatchEvent(new Event('input', { bubbles: true }))

    expect(frames).toHaveLength(1)
    expect(ranges).toEqual([])
    expect(container.querySelector('[data-month-value="from"]')?.textContent).toBe(
      'February 2024',
    )
    expect(from.getAttribute('aria-valuetext')).toBe('February 2024')
    frames[0]!(0)
    expect(ranges).toEqual([{ from: '2024-02', through: '2024-03' }])
  })

  it('clamps only the moved endpoint and flushes the final change', () => {
    const frames: FrameRequestCallback[] = []
    const cancel = vi.fn()
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    }))
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const model = new VisualizationModel({
      ...structuredClone(validIndex),
      source: { first_month: '2023-12', last_month: '2024-03' },
    })
    model.setMonthRange({ from: '2024-01', through: '2024-02' })
    const { container, ranges } = setup(model.getSnapshot())
    const from = container.querySelector<HTMLInputElement>(
      'input[data-month-bound="from"]',
    )!
    const through = container.querySelector<HTMLInputElement>(
      'input[data-month-bound="through"]',
    )!
    from.value = '3'
    from.dispatchEvent(new Event('input', { bubbles: true }))
    expect(from.value).toBe('2')
    expect(through.value).toBe('2')
    from.dispatchEvent(new Event('change', { bubbles: true }))
    expect(cancel).toHaveBeenCalledOnce()
    expect(ranges).toEqual([{ from: '2024-02', through: '2024-02' }])
  })

  it('moves the nearest endpoint when the shared track is clicked', () => {
    const { container, ranges } = setup(snapshot({
      first_month: '2024-01',
      last_month: '2024-12',
    }))
    const dualRange = container.querySelector<HTMLElement>('.ghc-dual-range')!
    vi.spyOn(dualRange, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 100,
    } as DOMRect)

    dualRange.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: 20,
    }))
    expect(ranges.at(-1)).toEqual({ from: '2024-03', through: '2024-12' })
    expect(document.activeElement).toBe(
      container.querySelector('input[data-month-bound="from"]'),
    )

    dualRange.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: 80,
    }))
    expect(ranges.at(-1)).toEqual({ from: '2024-03', through: '2024-10' })
    expect(document.activeElement).toBe(
      container.querySelector('input[data-month-bound="through"]'),
    )
  })

  it('resets only the month range and disables a one-month scale', () => {
    const model = new VisualizationModel({
      ...structuredClone(validIndex),
      source: { first_month: '2023-12', last_month: '2024-03' },
    })
    model.setContributionTypes(['reviews'])
    model.setMonthRange({ from: '2024-01', through: '2024-02' })
    const { container, ranges, types } = setup(model.getSnapshot())
    container.querySelector<HTMLButtonElement>('[data-action="all-months"]')!.click()
    expect(ranges).toEqual([{ from: '2023-12', through: '2024-03' }])
    expect(types).toEqual([])

    const oneMonth = snapshot({ first_month: '2024-01', last_month: '2024-01' })
    const second = setup(oneMonth)
    expect(
      Array.from(second.container.querySelectorAll<HTMLInputElement>(
        'input[data-month-bound]',
      )).every((input) => input.disabled && input.value === '0'),
    ).toBe(true)
  })

  it('retains control nodes and focus across synchronized updates', () => {
    const { container, controls } = setup()
    const from = container.querySelector<HTMLInputElement>(
      'input[data-month-bound="from"]',
    )!
    from.focus()
    const model = new VisualizationModel({
      ...structuredClone(validIndex),
      source: { first_month: '2023-12', last_month: '2024-03' },
    })
    model.setMonthRange({ from: '2024-01', through: '2024-02' })
    model.setContributionTypes(['pull_requests'])
    controls.update(container, model.getSnapshot())
    expect(container.querySelector('input[data-month-bound="from"]')).toBe(from)
    expect(document.activeElement).toBe(from)
    expect(from.value).toBe('1')
    expect(
      Array.from(container.querySelectorAll<HTMLInputElement>(
        'input[data-contribution-type]:checked',
      )).map((input) => input.dataset.contributionType),
    ).toEqual(['pull_requests'])
  })

  it('cancels queued work on synchronization and destruction', () => {
    const frames: FrameRequestCallback[] = []
    const cancel = vi.fn()
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    }))
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const { container, controls, ranges } = setup()
    const from = container.querySelector<HTMLInputElement>(
      'input[data-month-bound="from"]',
    )!
    from.value = '1'
    from.dispatchEvent(new Event('input', { bubbles: true }))
    controls.cancelPendingMonthRange()
    expect(cancel).toHaveBeenCalledOnce()
    frames[0]!(0)
    expect(ranges).toEqual([])

    from.value = '2'
    from.dispatchEvent(new Event('input', { bubbles: true }))
    controls.destroy()
    expect(cancel).toHaveBeenCalledTimes(2)
    frames[1]!(0)
    expect(ranges).toEqual([])
  })
})
