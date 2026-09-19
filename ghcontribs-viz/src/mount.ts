import type { ContributionType } from './data/types.ts'
import { loadVisualizationIndex, RepositoryDetailsLoader } from './data/load.ts'
import { layoutEcosystem } from './layout/treemap.ts'
import { InteractionController } from './interaction/controller.ts'
import { VisualizationModel } from './model/model.ts'
import { assertMonth, type MonthRange } from './model/months.ts'
import type { ContributionWeighting, SizeMode } from './model/weights.ts'
import {
  ensureEcosystemElements,
  renderEcosystem,
  renderLoadError,
  renderLoading,
} from './render/ecosystem.ts'
import { FilterControls } from './render/controls.ts'
import { renderDetails, type DetailState } from './render/details.ts'
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
  selectRepository(key: string | null): void
}

const DEFAULT_LAYOUT_WIDTH = 1200
const MINIMUM_LAYOUT_HEIGHT = 320
const MAXIMUM_LAYOUT_HEIGHT = 640
const DEFAULT_VISUALIZATION_CHROME_HEIGHT = 144
const VIEWPORT_BOTTOM_GUTTER = 16

function measureLayout(element: HTMLElement): { width: number; height: number } {
  const elementRect = element.getBoundingClientRect()
  const measuredWidth = elementRect.width || element.clientWidth
  const ecosystem = element.querySelector<HTMLElement>('.ghc-ecosystem')
  const ecosystemWidth = ecosystem?.getBoundingClientRect().width ?? 0
  const width = Math.max(1, Math.round(ecosystemWidth || measuredWidth || DEFAULT_LAYOUT_WIDTH))
  const outerHeight = (node: HTMLElement | null): number => {
    if (node === null) return 0
    const style = window.getComputedStyle(node)
    return node.offsetHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom)
  }
  const measuredChromeHeight = outerHeight(element.querySelector('.ghc-toolbar')) +
    outerHeight(element.querySelector('.ghc-controls')) +
    outerHeight(element.querySelector('.ghc-summary'))
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
  element.classList.add('ghc-viz-root')
  let model: VisualizationModel | null = null
  let destroyed = false
  let pendingContributionTypes: ContributionType[] | undefined
  let pendingMonthRange: MonthRange | undefined
  let pendingSizeMode: SizeMode | undefined
  let pendingOwnerWeighting = options.ownerContributionWeighting
  let pendingRepositoryWeighting = options.repositoryContributionWeighting
  let resizeFrame: number | null = null
  let selectedRepository: string | null = null
  let pendingRepository: string | null = null
  let detailState: DetailState | null = null
  let detailRequest = 0
  const detailsLoader = new RepositoryDetailsLoader(options.dataUrl)

  const findRepository = (key: string) => model?.getSnapshot().owners
    .flatMap((owner) => owner.repositories)
    .find((repository) => repository.key === key)

  const rerender = (): void => {
    if (destroyed || model === null) return
    const snapshot = model.getSnapshot()
    const elements = ensureEcosystemElements(element)
    filterControls.update(elements.controls, snapshot)
    renderDetails(
      element,
      selectedRepository === null ? null : findRepository(selectedRepository) ?? null,
      detailState,
      snapshot,
    )
    const { width, height } = measureLayout(element)
    const focusedOwner = interaction.focusedOwner
    const layout = layoutEcosystem(snapshot, width, height, { focusedOwner })
    renderEcosystem(element, snapshot, layout, focusedOwner)
    interaction.update(snapshot)
  }

  const startDetailsLoad = (): void => {
    if (selectedRepository === null) return
    const repository = findRepository(selectedRepository)
    if (repository === undefined) return
    const request = ++detailRequest
    detailState = { kind: 'loading' }
    rerender()
    void detailsLoader.load(repository.owner, {
      key: repository.key,
      name: repository.name,
      details_path: repository.detailsPath,
    }).then((details) => {
      if (destroyed || request !== detailRequest) return
      detailState = { kind: 'success', details }
      rerender()
    }).catch((error: unknown) => {
      if (destroyed || request !== detailRequest) return
      detailState = { kind: 'error', error }
      rerender()
    })
  }

  const selectRepository = (key: string | null): boolean => {
    if (destroyed) return false
    if (model === null) {
      pendingRepository = key
      return false
    }
    if (key !== null && findRepository(key) === undefined) return false
    if (key === selectedRepository) return false
    const restoreFocus = key === null &&
      element.querySelector('.ghc-details')?.contains(document.activeElement) === true
    const previous = selectedRepository
    selectedRepository = key
    detailState = null
    ++detailRequest
    if (key === null) {
      rerender()
      if (restoreFocus && previous !== null) {
        Array.from(element.querySelectorAll<HTMLElement>('.ghc-repository'))
          .find((tile) => tile.dataset.repositoryKey === previous)?.focus()
      }
    } else {
      startDetailsLoad()
    }
    return true
  }

  const interaction = new InteractionController(
    element,
    rerender,
    selectRepository,
    startDetailsLoad,
  )
  const filterControls = new FilterControls(element, {
    onContributionTypesChange(types): void {
      if (destroyed || model === null) return
      model.setContributionTypes(types)
      rerender()
    },
    onMonthRangeChange(range): void {
      if (destroyed || model === null) return
      model.setMonthRange(range)
      rerender()
    },
  })

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
      if (pendingRepository !== null) {
        const key = pendingRepository
        pendingRepository = null
        selectRepository(key)
      }
    })
    .catch((error: unknown) => {
      if (!destroyed) renderLoadError(element, error)
    })

  return {
    destroy(): void {
      destroyed = true
      ++detailRequest
      model = null
      interaction.destroy()
      filterControls.destroy()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleResize)
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame)
      resizeFrame = null
      element.replaceChildren()
      element.classList.remove('ghc-viz-root')
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
        filterControls.cancelPendingMonthRange()
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
    selectRepository,
  }
}
