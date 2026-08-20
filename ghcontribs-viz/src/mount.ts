import type { ContributionType } from './data/types.ts'
import { loadVisualizationIndex } from './data/load.ts'
import { layoutEcosystem } from './layout/treemap.ts'
import { VisualizationModel } from './model/model.ts'
import { assertMonth, type MonthRange } from './model/months.ts'
import type { SizeMode } from './model/weights.ts'
import {
  renderEcosystem,
  renderLoadError,
  renderLoading,
} from './render/ecosystem.ts'
import './style.css'

export interface ContributionEcosystemOptions {
  readonly dataUrl: string | URL
}

export interface ContributionEcosystem {
  destroy(): void
  setContributionTypes(types: ContributionType[]): void
  setMonthRange(range: MonthRange): void
  setSizeMode(mode: SizeMode): void
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

  const rerender = (): void => {
    if (destroyed || model === null) return
    const snapshot = model.getSnapshot()
    renderEcosystem(element, snapshot, layoutEcosystem(snapshot))
  }

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
      rerender()
    })
    .catch((error: unknown) => {
      if (!destroyed) renderLoadError(element, error)
    })

  return {
    destroy(): void {
      destroyed = true
      model = null
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
  }
}
