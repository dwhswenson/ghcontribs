import type { ContributionType } from './data/types.ts'
import { loadVisualizationIndex } from './data/load.ts'
import { layoutEcosystem } from './layout/treemap.ts'
import { InteractionController } from './interaction/controller.ts'
import { VisualizationModel } from './model/model.ts'
import { assertMonth, type MonthRange } from './model/months.ts'
import type { ContributionWeighting, SizeMode } from './model/weights.ts'
import {
  renderEcosystem,
  renderLoadError,
  renderLoading,
} from './render/ecosystem.ts'
import './style.css'

export interface ContributionEcosystemOptions {
  readonly dataUrl: string | URL
  readonly ownerContributionWeighting?: ContributionWeighting
  readonly repositoryContributionWeighting?: ContributionWeighting
}

export interface ContributionEcosystem {
  destroy(): void
  setContributionTypes(types: ContributionType[]): void
  setMonthRange(range: MonthRange): void
  setSizeMode(mode: SizeMode): void
  setOwnerContributionWeighting(weighting: ContributionWeighting): void
  setRepositoryContributionWeighting(weighting: ContributionWeighting): void
  focusOwner(owner: string | null): void
}

const DEFAULT_LAYOUT_WIDTH = 1200
const MINIMUM_LAYOUT_HEIGHT = 320
const MAXIMUM_LAYOUT_HEIGHT = 640
const DEFAULT_VISUALIZATION_CHROME_HEIGHT = 144
const VIEWPORT_BOTTOM_GUTTER = 16

function measureLayout(element: HTMLElement): { width: number; height: number } {
  const elementRect = element.getBoundingClientRect()
  const measuredWidth = elementRect.width || element.clientWidth
  const width = Math.max(1, Math.round(measuredWidth || DEFAULT_LAYOUT_WIDTH))
  const ecosystem = element.querySelector<HTMLElement>('.ghc-ecosystem')
  const visualization = element.querySelector<HTMLElement>('.ghc-visualization')
  const measuredChromeHeight = ecosystem !== null && visualization !== null
    ? visualization.offsetHeight - ecosystem.offsetHeight
    : 0
  const chromeHeight = measuredChromeHeight > 0
    ? measuredChromeHeight
    : DEFAULT_VISUALIZATION_CHROME_HEIGHT
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  const elementTop = Number.isFinite(elementRect.top) ? Math.max(0, elementRect.top) : 0
  const availableViewportHeight = viewportHeight - elementTop - chromeHeight
    - VIEWPORT_BOTTOM_GUTTER
  const maximumHeight = Math.min(MAXIMUM_LAYOUT_HEIGHT, availableViewportHeight)
  const height = Math.round(
    Math.max(MINIMUM_LAYOUT_HEIGHT, Math.min(maximumHeight, width * 2 / 3)),
  )
  return { width, height }
}

export function mountContributionEcosystem(
  element: HTMLElement,
  options: ContributionEcosystemOptions,
): ContributionEcosystem {
  let model: VisualizationModel | null = null
  let destroyed = false
  let pendingContributionTypes: ContributionType[] | undefined
  let pendingMonthRange: MonthRange | undefined
  let pendingSizeMode: SizeMode | undefined
  let pendingOwnerWeighting = options.ownerContributionWeighting
  let pendingRepositoryWeighting = options.repositoryContributionWeighting
  let resizeFrame: number | null = null

  const rerender = (): void => {
    if (destroyed || model === null) return
    const snapshot = model.getSnapshot()
    const { width, height } = measureLayout(element)
    const focusedOwner = interaction.focusedOwner
    const layout = layoutEcosystem(snapshot, width, height, { focusedOwner })
    renderEcosystem(element, snapshot, layout, focusedOwner)
    interaction.update(snapshot)
  }

  const interaction = new InteractionController(element, rerender)

  const scheduleResize = (): void => {
    if (destroyed || resizeFrame !== null) return
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null
      rerender()
    })
  }

  const resizeObserver = typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(scheduleResize)
  resizeObserver?.observe(element)
  window.addEventListener('resize', scheduleResize)

  renderLoading(element)
  void loadVisualizationIndex(options.dataUrl)
    .then((index) => {
      if (destroyed) return
      model = new VisualizationModel(index)
      if (pendingContributionTypes !== undefined) {
        model.setContributionTypes(pendingContributionTypes)
      }
      if (pendingMonthRange !== undefined) model.setMonthRange(pendingMonthRange)
      if (pendingSizeMode !== undefined) model.setSizeMode(pendingSizeMode)
      if (pendingOwnerWeighting !== undefined) {
        model.setOwnerContributionWeighting(pendingOwnerWeighting)
      }
      if (pendingRepositoryWeighting !== undefined) {
        model.setRepositoryContributionWeighting(pendingRepositoryWeighting)
      }
      rerender()
    })
    .catch((error: unknown) => {
      if (!destroyed) renderLoadError(element, error)
    })

  return {
    destroy(): void {
      destroyed = true
      model = null
      interaction.destroy()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleResize)
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame)
      resizeFrame = null
      element.replaceChildren()
    },
    setContributionTypes(types: ContributionType[]): void {
      pendingContributionTypes = [...types]
      if (model !== null) {
        model.setContributionTypes(types)
        rerender()
      }
    },
    setMonthRange(range: MonthRange): void {
      assertMonth(range.from, 'month range from')
      assertMonth(range.through, 'month range through')
      if (range.from > range.through) {
        throw new RangeError('month range from must not be after through')
      }
      pendingMonthRange = { from: range.from, through: range.through }
      if (model !== null) {
        model.setMonthRange(range)
        rerender()
      }
    },
    setSizeMode(mode: SizeMode): void {
      pendingSizeMode = mode
      if (model !== null) {
        model.setSizeMode(mode)
        rerender()
      }
    },
    setOwnerContributionWeighting(weighting: ContributionWeighting): void {
      pendingOwnerWeighting = weighting
      if (model !== null) {
        model.setOwnerContributionWeighting(weighting)
        rerender()
      }
    },
    setRepositoryContributionWeighting(weighting: ContributionWeighting): void {
      pendingRepositoryWeighting = weighting
      if (model !== null) {
        model.setRepositoryContributionWeighting(weighting)
        rerender()
      }
    },
    focusOwner(owner: string | null): void {
      interaction.focusOwner(owner)
    },
  }
}
