import type { ContributionType } from '../data/types.ts'
import { CONTRIBUTION_TYPES } from '../model/counts.ts'
import {
  formatMonth,
  isCompleteMonthRange,
  monthFromOffset,
  monthOffset,
  monthSpan,
  type MonthRange,
} from '../model/months.ts'
import type { VisualizationSnapshot } from '../model/model.ts'

const TYPE_CONTROLS: ReadonlyArray<{
  readonly type: ContributionType
  readonly label: string
}> = [
  { type: 'pull_requests', label: 'PR' },
  { type: 'issues', label: 'Issue' },
  { type: 'reviews', label: 'Review' },
  { type: 'comments', label: 'Comment' },
]

export interface FilterControlsCallbacks {
  readonly onContributionTypesChange: (types: ContributionType[]) => void
  readonly onMonthRangeChange: (range: MonthRange) => void
  readonly onPanelVisibilityChange?: (previousDetailsBounds: DetailsBounds | null) => void
}

export interface DetailsBounds {
  readonly top: number
  readonly height: number
}

function createTypeControls(): HTMLFieldSetElement {
  const fieldset = document.createElement('fieldset')
  fieldset.className = 'ghc-controls__types'
  const legend = document.createElement('legend')
  legend.textContent = 'Contribution types'
  fieldset.append(legend)

  for (const control of TYPE_CONTROLS) {
    const label = document.createElement('label')
    label.className = 'ghc-type-control'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.dataset.contributionType = control.type
    const text = document.createElement('span')
    text.textContent = control.label
    label.append(input, text)
    fieldset.append(label)
  }
  return fieldset
}

let nextControlsId = 0

function createMonthEndpoint(
  bound: 'from' | 'through',
  labelText: string,
  idPrefix: string,
): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = `ghc-month-endpoint ghc-month-endpoint--${bound}`
  const label = document.createElement('label')
  label.className = 'ghc-visually-hidden'
  label.textContent = labelText
  const value = document.createElement('output')
  value.className = 'ghc-month-control__value'
  value.dataset.monthValue = bound
  label.htmlFor = `${idPrefix}-${bound}`
  wrapper.append(label, value)
  return wrapper
}

function createMonthInput(bound: 'from' | 'through', idPrefix: string): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'range'
  input.step = '1'
  input.dataset.monthBound = bound
  input.id = `${idPrefix}-${bound}`
  return input
}

function createControls(container: HTMLElement, idPrefix: string): void {
  container.className = 'ghc-controls'
  const header = document.createElement('div')
  header.className = 'ghc-controls__header'
  const heading = document.createElement('h2')
  heading.id = `${idPrefix}-heading`
  heading.textContent = 'Filters'
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'ghc-controls__close'
  close.dataset.action = 'close-filters'
  close.setAttribute('aria-label', 'Close filters')
  close.textContent = '×'
  header.append(heading, close)
  container.setAttribute('aria-labelledby', heading.id)
  const types = createTypeControls()
  const months = document.createElement('fieldset')
  months.className = 'ghc-controls__months'
  const legend = document.createElement('legend')
  legend.textContent = 'Month range'
  const values = document.createElement('div')
  values.className = 'ghc-dual-range__values'
  values.append(
    createMonthEndpoint('from', 'Start month', idPrefix),
    createMonthEndpoint('through', 'End month', idPrefix),
  )
  const range = document.createElement('div')
  range.className = 'ghc-dual-range'
  const track = document.createElement('span')
  track.className = 'ghc-dual-range__track'
  track.setAttribute('aria-hidden', 'true')
  const selectedTrack = document.createElement('span')
  selectedTrack.className = 'ghc-dual-range__selection'
  selectedTrack.setAttribute('aria-hidden', 'true')
  range.append(
    track,
    selectedTrack,
    createMonthInput('from', idPrefix),
    createMonthInput('through', idPrefix),
  )
  const rangeRow = document.createElement('div')
  rangeRow.className = 'ghc-controls__range-row'
  const reset = document.createElement('button')
  reset.type = 'button'
  reset.dataset.action = 'all-months'
  reset.textContent = 'All months'
  rangeRow.append(range, reset)
  months.append(legend, values, rangeRow)
  container.append(header, types, months)
}

export class FilterControls {
  readonly #target: HTMLElement
  readonly #callbacks: FilterControlsCallbacks
  readonly #idPrefix = `ghc-month-${nextControlsId++}`
  #sourceRange: MonthRange | null = null
  #pendingRange: MonthRange | null = null
  #rangeFrame: number | null = null
  #open = false
  #destroyed = false

  constructor(target: HTMLElement, callbacks: FilterControlsCallbacks) {
    this.#target = target
    this.#callbacks = callbacks
    target.addEventListener('input', this.#handleInput)
    target.addEventListener('change', this.#handleChange)
    target.addEventListener('click', this.#handleClick)
    target.addEventListener('keydown', this.#handleKeyDown, true)
  }

  get isOpen(): boolean {
    return this.#open
  }

  update(container: HTMLElement, snapshot: VisualizationSnapshot): void {
    if (this.#destroyed) return
    if (container.childElementCount === 0) createControls(container, this.#idPrefix)
    const trigger = this.#trigger()
    container.id = `${this.#idPrefix}-panel`
    container.hidden = !this.#open
    trigger?.setAttribute('aria-controls', container.id)
    trigger?.setAttribute('aria-expanded', String(this.#open))
    this.#sourceRange = snapshot.sourceRange

    const selected = new Set(snapshot.contributionTypes)
    for (const input of container.querySelectorAll<HTMLInputElement>(
      'input[data-contribution-type]',
    )) {
      input.checked = selected.has(input.dataset.contributionType as ContributionType)
    }

    const displayedRange = this.#pendingRange ?? snapshot.monthRange
    this.#updateMonthControls(container, displayedRange, snapshot.sourceRange)
    const active = snapshot.contributionTypes.length !== CONTRIBUTION_TYPES.length ||
      !isCompleteMonthRange(snapshot.monthRange, snapshot.sourceRange)
    trigger?.classList.toggle('ghc-filter-trigger--active', active)
    trigger?.setAttribute('aria-label', active ? 'Filters, active' : 'Filters')
  }

  cancelPendingMonthRange(): void {
    this.#pendingRange = null
    if (this.#rangeFrame !== null) cancelAnimationFrame(this.#rangeFrame)
    this.#rangeFrame = null
  }

  destroy(): void {
    if (this.#destroyed) return
    this.#destroyed = true
    this.cancelPendingMonthRange()
    this.#target.removeEventListener('input', this.#handleInput)
    this.#target.removeEventListener('change', this.#handleChange)
    this.#target.removeEventListener('click', this.#handleClick)
    this.#target.removeEventListener('keydown', this.#handleKeyDown, true)
  }

  #controls(): HTMLElement | null {
    return this.#target.querySelector<HTMLElement>('.ghc-controls')
  }

  #trigger(): HTMLButtonElement | null {
    return this.#target.querySelector<HTMLButtonElement>('.ghc-filter-trigger')
  }

  #setOpen(open: boolean, restoreFocus = false): void {
    if (this.#open === open) return
    const detailsRect = this.#target.querySelector<HTMLElement>('.ghc-details')
      ?.getBoundingClientRect()
    const previousDetailsBounds = detailsRect === undefined
      ? null
      : { top: detailsRect.top, height: detailsRect.height }
    this.#open = open
    const controls = this.#controls()
    const trigger = this.#trigger()
    if (controls !== null) controls.hidden = !open
    trigger?.setAttribute('aria-expanded', String(open))
    this.#callbacks.onPanelVisibilityChange?.(previousDetailsBounds)
    if (!open && restoreFocus) trigger?.focus()
  }

  #updateMonthControls(
    container: HTMLElement,
    range: MonthRange,
    source: MonthRange,
  ): void {
    const maximum = monthSpan(source) - 1
    const disabled = maximum === 0
    const offsets: Record<'from' | 'through', number> = { from: 0, through: 0 }
    for (const bound of ['from', 'through'] as const) {
      const input = container.querySelector<HTMLInputElement>(
        `input[data-month-bound="${bound}"]`,
      )!
      const month = range[bound]
      input.min = '0'
      input.max = String(maximum)
      offsets[bound] = monthOffset(month, source)
      input.value = String(offsets[bound])
      input.disabled = disabled
      input.setAttribute('aria-valuetext', formatMonth(month))
      container.querySelector<HTMLOutputElement>(
        `[data-month-value="${bound}"]`,
      )!.textContent = formatMonth(month)
    }
    const visualRange = container.querySelector<HTMLElement>('.ghc-dual-range')!
    const denominator = Math.max(1, maximum)
    visualRange.style.setProperty(
      '--ghc-range-from',
      `${offsets.from / denominator * 100}%`,
    )
    visualRange.style.setProperty(
      '--ghc-range-through',
      `${offsets.through / denominator * 100}%`,
    )
    container.querySelector<HTMLButtonElement>('[data-action="all-months"]')!.disabled =
      isCompleteMonthRange(range, source)
  }

  #rangeFromInputs(active: HTMLInputElement): MonthRange | null {
    const container = this.#controls()
    const source = this.#sourceRange
    if (container === null || source === null) return null
    const fromInput = container.querySelector<HTMLInputElement>(
      'input[data-month-bound="from"]',
    )!
    const throughInput = container.querySelector<HTMLInputElement>(
      'input[data-month-bound="through"]',
    )!
    let from = Number(fromInput.value)
    let through = Number(throughInput.value)
    if (active.dataset.monthBound === 'from' && from > through) {
      from = through
      fromInput.value = String(from)
    } else if (active.dataset.monthBound === 'through' && through < from) {
      through = from
      throughInput.value = String(through)
    }
    const range = {
      from: monthFromOffset(from, source),
      through: monthFromOffset(through, source),
    }
    this.#updateMonthControls(container, range, source)
    return range
  }

  #scheduleRange(range: MonthRange): void {
    this.#pendingRange = range
    if (this.#rangeFrame !== null) return
    this.#rangeFrame = requestAnimationFrame(() => {
      this.#rangeFrame = null
      const pending = this.#pendingRange
      this.#pendingRange = null
      if (!this.#destroyed && pending !== null) {
        this.#callbacks.onMonthRangeChange(pending)
      }
    })
  }

  #flushRange(range: MonthRange): void {
    if (this.#rangeFrame !== null) cancelAnimationFrame(this.#rangeFrame)
    this.#rangeFrame = null
    this.#pendingRange = null
    this.#callbacks.onMonthRangeChange(range)
  }

  #handleInput = (event: Event): void => {
    const input = event.target
    if (!(input instanceof HTMLInputElement) || input.dataset.monthBound === undefined) {
      return
    }
    const range = this.#rangeFromInputs(input)
    if (range !== null) this.#scheduleRange(range)
  }

  #handleChange = (event: Event): void => {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) return
    if (input.dataset.contributionType !== undefined) {
      const selected = new Set(
        Array.from(
          this.#controls()?.querySelectorAll<HTMLInputElement>(
            'input[data-contribution-type]:checked',
          ) ?? [],
        ).map((candidate) => candidate.dataset.contributionType as ContributionType),
      )
      this.#callbacks.onContributionTypesChange(
        CONTRIBUTION_TYPES.filter((type) => selected.has(type)),
      )
      return
    }
    if (input.dataset.monthBound !== undefined) {
      const range = this.#rangeFromInputs(input)
      if (range !== null) this.#flushRange(range)
    }
  }

  #handleClick = (event: MouseEvent): void => {
    const element = event.target as Element | null
    if (element?.closest('[data-action="toggle-filters"]') != null) {
      this.#setOpen(!this.#open)
      return
    }
    if (element?.closest('[data-action="close-filters"]') != null) {
      this.#setOpen(false, true)
      return
    }
    const dualRange = element?.closest<HTMLElement>('.ghc-dual-range')
    if (dualRange !== undefined && dualRange !== null && !(element instanceof HTMLInputElement)) {
      const source = this.#sourceRange
      if (source === null) return
      const inputs = {
        from: dualRange.querySelector<HTMLInputElement>(
          'input[data-month-bound="from"]',
        )!,
        through: dualRange.querySelector<HTMLInputElement>(
          'input[data-month-bound="through"]',
        )!,
      }
      const rect = dualRange.getBoundingClientRect()
      const ratio = rect.width === 0
        ? 0
        : Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
      const offset = Math.round(ratio * (monthSpan(source) - 1))
      const fromDistance = Math.abs(offset - Number(inputs.from.value))
      const throughDistance = Math.abs(offset - Number(inputs.through.value))
      const selected = fromDistance <= throughDistance ? inputs.from : inputs.through
      selected.value = String(offset)
      const range = this.#rangeFromInputs(selected)
      selected.focus()
      if (range !== null) this.#flushRange(range)
      return
    }
    if (element?.closest('[data-action="all-months"]') == null) return
    if (this.#sourceRange === null) return
    this.cancelPendingMonthRange()
    this.#callbacks.onMonthRangeChange(this.#sourceRange)
  }

  #handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.#open || event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    this.#setOpen(false, true)
  }
}
