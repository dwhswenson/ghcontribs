import type {
  ContributionCounts,
  ContributionType,
  VisualizationIndex,
} from '../data/types.ts'
import {
  CONTRIBUTION_TYPES,
  addCounts,
  repositoryCountsForRange,
  totalCount,
  zeroCounts,
} from './counts.ts'
import {
  sourceMonthRange,
  validateMonthRange,
  type MonthRange,
} from './months.ts'
import {
  repositoryWeight,
  type ContributionWeighting,
  type SizeMode,
} from './weights.ts'

export interface RepositoryViewModel {
  readonly key: string
  readonly owner: string
  readonly name: string
  readonly counts: Readonly<ContributionCounts>
  readonly totalContributions: number
  readonly weight: number
}

export interface OwnerViewModel {
  readonly owner: string
  readonly counts: Readonly<ContributionCounts>
  readonly totalContributions: number
  readonly weight: number
  readonly repositories: readonly RepositoryViewModel[]
}

export interface VisualizationSnapshot {
  readonly user: string
  readonly sourceRange: MonthRange
  readonly contributionTypes: readonly ContributionType[]
  readonly monthRange: MonthRange
  readonly sizeMode: SizeMode
  readonly ownerContributionWeighting: ContributionWeighting
  readonly repositoryContributionWeighting: ContributionWeighting
  readonly counts: Readonly<ContributionCounts>
  readonly totalContributions: number
  readonly hasContributions: boolean
  readonly owners: readonly OwnerViewModel[]
}

const CONTRIBUTION_TYPE_SET: ReadonlySet<string> = new Set(CONTRIBUTION_TYPES)
const SIZE_MODES: ReadonlySet<string> = new Set(['contributions', 'equal'])

function freezeCounts(counts: ContributionCounts): Readonly<ContributionCounts> {
  return Object.freeze(counts)
}

function normalizeContributionTypes(
  types: readonly ContributionType[],
): readonly ContributionType[] {
  for (const type of types) {
    if (!CONTRIBUTION_TYPE_SET.has(type)) {
      throw new RangeError(`Unsupported contribution type: ${String(type)}`)
    }
  }
  const requested = new Set(types)
  return Object.freeze(CONTRIBUTION_TYPES.filter((type) => requested.has(type)))
}

function validateSizeMode(mode: SizeMode): SizeMode {
  if (!SIZE_MODES.has(mode)) {
    throw new RangeError(`Unsupported size mode: ${String(mode)}`)
  }
  return mode
}

export class VisualizationModel {
  readonly #index: VisualizationIndex
  readonly #sourceRange: MonthRange
  #contributionTypes: readonly ContributionType[]
  #monthRange: MonthRange
  #sizeMode: SizeMode
  #ownerContributionWeighting: ContributionWeighting
  #repositoryContributionWeighting: ContributionWeighting

  constructor(index: VisualizationIndex) {
    this.#index = index
    this.#sourceRange = sourceMonthRange(index.source)
    this.#contributionTypes = Object.freeze([...CONTRIBUTION_TYPES])
    this.#monthRange = this.#sourceRange
    this.#sizeMode = 'contributions'
    this.#ownerContributionWeighting = 'sqrt'
    this.#repositoryContributionWeighting = 'sqrt'
  }

  setContributionTypes(types: readonly ContributionType[]): void {
    this.#contributionTypes = normalizeContributionTypes(types)
  }

  setMonthRange(range: MonthRange): void {
    this.#monthRange = validateMonthRange(range, this.#sourceRange)
  }

  setSizeMode(mode: SizeMode): void {
    this.#sizeMode = validateSizeMode(mode)
  }

  setOwnerContributionWeighting(weighting: ContributionWeighting): void {
    repositoryWeight('contributions', 1, weighting)
    this.#ownerContributionWeighting = weighting
  }

  setRepositoryContributionWeighting(weighting: ContributionWeighting): void {
    repositoryWeight('contributions', 1, weighting)
    this.#repositoryContributionWeighting = weighting
  }

  getSnapshot(): VisualizationSnapshot {
    const selectedTypes = new Set(this.#contributionTypes)
    let datasetCounts = zeroCounts()

    const owners = this.#index.owners.map((owner): OwnerViewModel => {
      let ownerCounts = zeroCounts()
      let repositoryWeightTotal = 0
      const repositories = owner.repositories.map(
        (repository): RepositoryViewModel => {
          const counts = repositoryCountsForRange(
            repository.contributions,
            this.#monthRange,
            this.#sourceRange,
            selectedTypes,
          )
          const repositoryTotal = totalCount(counts)
          const weight = repositoryWeight(
            this.#sizeMode,
            repositoryTotal,
            this.#repositoryContributionWeighting,
          )
          ownerCounts = addCounts(ownerCounts, counts)
          repositoryWeightTotal += weight
          return Object.freeze({
            key: repository.key,
            owner: owner.owner,
            name: repository.name,
            counts: freezeCounts(counts),
            totalContributions: repositoryTotal,
            weight,
          })
        },
      )

      datasetCounts = addCounts(datasetCounts, ownerCounts)
      const ownerTotal = totalCount(ownerCounts)
      const ownerWeight = this.#sizeMode === 'equal'
        ? repositoryWeightTotal
        : repositoryWeight(
            'contributions',
            ownerTotal,
            this.#ownerContributionWeighting,
          )
      return Object.freeze({
        owner: owner.owner,
        counts: freezeCounts(ownerCounts),
        totalContributions: ownerTotal,
        weight: ownerWeight,
        repositories: Object.freeze(repositories),
      })
    })

    const datasetTotal = totalCount(datasetCounts)
    return Object.freeze({
      user: this.#index.user,
      sourceRange: this.#sourceRange,
      contributionTypes: this.#contributionTypes,
      monthRange: this.#monthRange,
      sizeMode: this.#sizeMode,
      ownerContributionWeighting: this.#ownerContributionWeighting,
      repositoryContributionWeighting: this.#repositoryContributionWeighting,
      counts: freezeCounts(datasetCounts),
      totalContributions: datasetTotal,
      hasContributions: datasetTotal > 0,
      owners: Object.freeze(owners),
    })
  }
}
