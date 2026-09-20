import type {
  Contribution,
  ContributionType,
  Month,
  RepositoryDetails,
} from '../data/types.ts'
import type { MonthRange } from './months.ts'

const FILTER_TYPES: Record<Contribution['contrib_type'], ContributionType> = {
  issue: 'issues',
  pullRequest: 'pull_requests',
  pullRequestReview: 'reviews',
  issueComment: 'comments',
}

export interface IndexedContribution {
  readonly contribution: Contribution
  readonly month: Month
  readonly filterType: ContributionType
}

export interface IndexedContributionMonth {
  readonly month: Month
  readonly entries: readonly IndexedContribution[]
}

function compareContributions(left: Contribution, right: Contribution): number {
  return Date.parse(left.created) - Date.parse(right.created) ||
    left.url.localeCompare(right.url) ||
    left.contrib_type.localeCompare(right.contrib_type)
}

/**
 * Parses and orders repository details once, then serves filter changes from
 * UTC-month buckets instead of rescanning and resorting the source data.
 */
export class RepositoryDetailIndex {
  readonly entries: readonly IndexedContribution[]
  readonly months: readonly IndexedContributionMonth[]

  constructor(details: RepositoryDetails) {
    const byMonth = new Map<Month, IndexedContribution[]>()
    const entries = [...details.contributions]
      .sort(compareContributions)
      .map((contribution): IndexedContribution => {
        const month = new Date(contribution.created).toISOString().slice(0, 7)
        const entry = Object.freeze({
          contribution,
          month,
          filterType: FILTER_TYPES[contribution.contrib_type],
        })
        const bucket = byMonth.get(month)
        if (bucket === undefined) byMonth.set(month, [entry])
        else bucket.push(entry)
        return entry
      })

    this.entries = Object.freeze(entries)
    this.months = Object.freeze(
      [...byMonth.keys()].sort().map((month) => Object.freeze({
        month,
        entries: Object.freeze(byMonth.get(month)!),
      })),
    )
  }

  select(
    range: MonthRange,
    contributionTypes: readonly ContributionType[],
  ): readonly IndexedContribution[] {
    const selectedTypes = new Set(contributionTypes)
    const selected: IndexedContribution[] = []
    for (const bucket of this.months) {
      if (bucket.month < range.from) continue
      if (bucket.month > range.through) break
      for (const entry of bucket.entries) {
        if (selectedTypes.has(entry.filterType)) selected.push(entry)
      }
    }
    return selected
  }
}
