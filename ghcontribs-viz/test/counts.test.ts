import { describe, expect, it } from 'vitest'

import type { ContributionType, RepositoryContributions } from '../src/data/types.ts'
import {
  addCounts,
  repositoryCountsForRange,
  selectCounts,
  totalCount,
  zeroCounts,
} from '../src/model/counts.ts'

const contributions: RepositoryContributions = {
  total: { issues: 5, pull_requests: 7, reviews: 9, comments: 11 },
  by_month: {
    '2024-01': { issues: 1, pull_requests: 2, reviews: 3, comments: 4 },
    '2024-03': { issues: 4, pull_requests: 5, reviews: 6, comments: 7 },
  },
}
const source = { from: '2024-01', through: '2024-03' }
const allTypes = new Set<ContributionType>([
  'issues',
  'pull_requests',
  'reviews',
  'comments',
])

describe('count utilities', () => {
  it('creates complete independent zero counts', () => {
    const first = zeroCounts()
    const second = zeroCounts()
    expect(first).toEqual({ issues: 0, pull_requests: 0, reviews: 0, comments: 0 })
    expect(first).not.toBe(second)
  })

  it('adds every contribution category without changing either input', () => {
    const left = { issues: 1, pull_requests: 2, reviews: 3, comments: 4 }
    const right = { issues: 5, pull_requests: 6, reviews: 7, comments: 8 }
    expect(addCounts(left, right)).toEqual({
      issues: 6,
      pull_requests: 8,
      reviews: 10,
      comments: 12,
    })
    expect(left.issues).toBe(1)
    expect(right.issues).toBe(5)
  })

  it('zeros unselected contribution categories', () => {
    expect(
      selectCounts(contributions.total, new Set(['issues', 'reviews'])),
    ).toEqual({ issues: 5, pull_requests: 0, reviews: 9, comments: 0 })
    expect(selectCounts(contributions.total, new Set())).toEqual(zeroCounts())
  })

  it('totals all four categories', () => {
    expect(totalCount(contributions.total)).toBe(32)
  })

  it('uses precomputed totals for the complete source range', () => {
    expect(
      repositoryCountsForRange(contributions, source, source, allTypes),
    ).toEqual(contributions.total)
  })

  it('aggregates an inclusive partial range with missing months as zero', () => {
    expect(
      repositoryCountsForRange(
        contributions,
        { from: '2024-02', through: '2024-03' },
        source,
        allTypes,
      ),
    ).toEqual({ issues: 4, pull_requests: 5, reviews: 6, comments: 7 })
    expect(
      repositoryCountsForRange(
        contributions,
        { from: '2024-02', through: '2024-02' },
        source,
        allTypes,
      ),
    ).toEqual(zeroCounts())
  })

  it('applies contribution filters after month aggregation', () => {
    expect(
      repositoryCountsForRange(
        contributions,
        { from: '2024-01', through: '2024-01' },
        source,
        new Set(['pull_requests', 'comments']),
      ),
    ).toEqual({ issues: 0, pull_requests: 2, reviews: 0, comments: 4 })
  })
})
