import type {
  ContributionCounts,
  ContributionType,
  RepositoryContributions,
} from '../data/types.ts'
import {
  isCompleteMonthRange,
  monthIsInRange,
  type MonthRange,
} from './months.ts'

export const CONTRIBUTION_TYPES = [
  'issues',
  'pull_requests',
  'reviews',
  'comments',
] as const satisfies readonly ContributionType[]

export function zeroCounts(): ContributionCounts {
  return {
    issues: 0,
    pull_requests: 0,
    reviews: 0,
    comments: 0,
  }
}

export function addCounts(
  left: ContributionCounts,
  right: ContributionCounts,
): ContributionCounts {
  return {
    issues: left.issues + right.issues,
    pull_requests: left.pull_requests + right.pull_requests,
    reviews: left.reviews + right.reviews,
    comments: left.comments + right.comments,
  }
}

export function selectCounts(
  counts: ContributionCounts,
  selectedTypes: ReadonlySet<ContributionType>,
): ContributionCounts {
  return {
    issues: selectedTypes.has('issues') ? counts.issues : 0,
    pull_requests: selectedTypes.has('pull_requests')
      ? counts.pull_requests
      : 0,
    reviews: selectedTypes.has('reviews') ? counts.reviews : 0,
    comments: selectedTypes.has('comments') ? counts.comments : 0,
  }
}

export function totalCount(counts: ContributionCounts): number {
  return CONTRIBUTION_TYPES.reduce((total, type) => total + counts[type], 0)
}

export function repositoryCountsForRange(
  contributions: RepositoryContributions,
  range: MonthRange,
  source: MonthRange,
  selectedTypes: ReadonlySet<ContributionType>,
): ContributionCounts {
  let counts: ContributionCounts
  if (isCompleteMonthRange(range, source)) {
    counts = { ...contributions.total }
  } else {
    counts = zeroCounts()
    for (const [month, monthCounts] of Object.entries(contributions.by_month)) {
      if (monthIsInRange(month, range)) {
        counts = addCounts(counts, monthCounts)
      }
    }
  }
  return selectCounts(counts, selectedTypes)
}
