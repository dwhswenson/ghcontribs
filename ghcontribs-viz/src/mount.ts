import type { ContributionType } from './data/types.ts'
import { loadVisualizationIndex } from './data/load.ts'
import { layoutEcosystem } from './layout/treemap.ts'
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
}

const DEFAULT_LAYOUT_WIDTH = 1200
const MINIMUM_LAYOUT_HEIGHT = 320
const MAXIMUM_LAYOUT_HEIGHT = 800

function measureLayout(element: HTMLElement): { width: number; height: number } {
  const measuredWidth = element.getBoundingClientRect().width || element.clientWidth
  const width = Math.max(1, Math.round(measuredWidth || DEFAULT_LAYOUT_WIDTH))
  const height = Math.round(
    Math.min(MAXIMUM_LAYOUT_HEIGHT, Math.max(MINIMUM_LAYOUT_HEIGHT, width * 2 / 3)),
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
    renderEcosystem(element, snapshot, layoutEcosystem(snapshot, width, height))
  }

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
      resizeObserver?.disconnect()
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
  }
}
