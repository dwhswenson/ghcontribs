import { describe, expect, it } from 'vitest'

import type { VisualizationIndex } from '../src/data/types.ts'
import { VisualizationModel } from '../src/model/model.ts'
import { repositoryWeight } from '../src/model/weights.ts'

const index: VisualizationIndex = {
  schema_version: 1,
  user: 'octocat',
  source: { first_month: '2024-01', last_month: '2024-03' },
  owners: [
    {
      owner: 'FirstOwner',
      repositories: [
        {
          key: 'FirstOwner/alpha',
          name: 'alpha',
          contributions: {
            total: { issues: 3, pull_requests: 2, reviews: 1, comments: 4 },
            by_month: {
              '2024-01': { issues: 1, pull_requests: 2, reviews: 0, comments: 0 },
              '2024-03': { issues: 2, pull_requests: 0, reviews: 1, comments: 4 },
            },
          },
        },
        {
          key: 'FirstOwner/beta',
          name: 'beta',
          contributions: {
            total: { issues: 0, pull_requests: 1, reviews: 2, comments: 0 },
            by_month: {
              '2024-02': { issues: 0, pull_requests: 1, reviews: 2, comments: 0 },
            },
          },
        },
      ],
    },
    {
      owner: 'SecondOwner',
      repositories: [
        {
          key: 'SecondOwner/gamma',
          name: 'gamma',
          contributions: {
            total: { issues: 1, pull_requests: 0, reviews: 0, comments: 1 },
            by_month: {
              '2024-03': { issues: 1, pull_requests: 0, reviews: 0, comments: 1 },
            },
          },
        },
      ],
    },
  ],
}

function cloneIndex(): VisualizationIndex {
  return structuredClone(index)
}

describe('VisualizationModel', () => {
  it('starts with all contribution types, the source range, and contribution sizing', () => {
    const snapshot = new VisualizationModel(cloneIndex()).getSnapshot()
    expect(snapshot.contributionTypes).toEqual([
      'issues',
      'pull_requests',
      'reviews',
      'comments',
    ])
    expect(snapshot.monthRange).toEqual({ from: '2024-01', through: '2024-03' })
    expect(snapshot.sizeMode).toBe('contributions')
    expect(snapshot.counts).toEqual({
      issues: 4,
      pull_requests: 3,
      reviews: 3,
      comments: 5,
    })
    expect(snapshot.totalContributions).toBe(15)
    expect(snapshot.hasContributions).toBe(true)
  })

  it('preserves index ordering and sums repository counts into owners', () => {
    const snapshot = new VisualizationModel(cloneIndex()).getSnapshot()
    expect(snapshot.owners.map((owner) => owner.owner)).toEqual([
      'FirstOwner',
      'SecondOwner',
    ])
    expect(snapshot.owners[0]?.repositories.map((repository) => repository.key)).toEqual([
      'FirstOwner/alpha',
      'FirstOwner/beta',
    ])
    expect(snapshot.owners[0]?.counts).toEqual({
      issues: 3,
      pull_requests: 3,
      reviews: 3,
      comments: 4,
    })
    expect(snapshot.owners[0]?.totalContributions).toBe(13)
  })

  it('deduplicates and canonically orders contribution filters', () => {
    const model = new VisualizationModel(cloneIndex())
    model.setContributionTypes(['comments', 'issues', 'comments'])
    const snapshot = model.getSnapshot()
    expect(snapshot.contributionTypes).toEqual(['issues', 'comments'])
    expect(snapshot.counts).toEqual({
      issues: 4,
      pull_requests: 0,
      reviews: 0,
      comments: 5,
    })
  })

  it('filters an inclusive single-month range using sparse monthly data', () => {
    const model = new VisualizationModel(cloneIndex())
    model.setMonthRange({ from: '2024-02', through: '2024-02' })
    const snapshot = model.getSnapshot()
    expect(snapshot.counts).toEqual({
      issues: 0,
      pull_requests: 1,
      reviews: 2,
      comments: 0,
    })
    expect(snapshot.owners[1]?.totalContributions).toBe(0)
  })

  it('reports a valid empty contribution filter as zero results', () => {
    const model = new VisualizationModel(cloneIndex())
    model.setContributionTypes([])
    const snapshot = model.getSnapshot()
    expect(snapshot.totalContributions).toBe(0)
    expect(snapshot.hasContributions).toBe(false)
    expect(snapshot.owners[0]?.repositories[0]?.weight).toBe(0)
  })

  it('changes sizing policy without changing active counts', () => {
    const model = new VisualizationModel(cloneIndex())
    model.setContributionTypes([])
    const contributionSnapshot = model.getSnapshot()
    model.setSizeMode('equal')
    const equalSnapshot = model.getSnapshot()

    expect(equalSnapshot.counts).toEqual(contributionSnapshot.counts)
    expect(equalSnapshot.hasContributions).toBe(false)
    expect(equalSnapshot.owners[0]?.repositories.map((repository) => repository.weight)).toEqual([
      1,
      1,
    ])
    expect(equalSnapshot.owners[0]?.weight).toBe(2)
    expect(equalSnapshot.owners[1]?.weight).toBe(1)
  })

  it('returns deeply frozen snapshots and does not mutate the input index', () => {
    const input = cloneIndex()
    const before = structuredClone(input)
    const snapshot = new VisualizationModel(input).getSnapshot()
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.counts)).toBe(true)
    expect(Object.isFrozen(snapshot.owners)).toBe(true)
    expect(Object.isFrozen(snapshot.owners[0])).toBe(true)
    expect(Object.isFrozen(snapshot.owners[0]?.repositories)).toBe(true)
    expect(Object.isFrozen(snapshot.owners[0]?.repositories[0]?.counts)).toBe(true)
    expect(input).toEqual(before)
  })

  it.each([
    [{ from: '2024-00', through: '2024-01' }, 'real calendar month'],
    [{ from: '2024-03', through: '2024-02' }, 'must not be after'],
    [{ from: '2023-12', through: '2024-02' }, 'must be within'],
    [{ from: '2024-02', through: '2024-04' }, 'must be within'],
  ])('rejects invalid month range %j', (range, message) => {
    const model = new VisualizationModel(cloneIndex())
    expect(() => model.setMonthRange(range)).toThrow(message)
  })

  it('rejects a reversed source range', () => {
    const input = cloneIndex()
    input.source = { first_month: '2024-03', last_month: '2024-01' }
    expect(() => new VisualizationModel(input)).toThrow(
      'first_month must not be after',
    )
  })

  it('rejects unsupported runtime filter and size values', () => {
    const model = new VisualizationModel(cloneIndex())
    expect(() =>
      model.setContributionTypes(['commits' as never]),
    ).toThrow('Unsupported contribution type')
    expect(() => model.setSizeMode('impact' as never)).toThrow(
      'Unsupported size mode',
    )
  })
})

describe('repositoryWeight', () => {
  it('uses contribution activity only for contribution sizing', () => {
    expect(repositoryWeight('contributions', 12)).toBe(12)
    expect(repositoryWeight('contributions', 0)).toBe(0)
  })

  it('uses one for equal sizing regardless of activity', () => {
    expect(repositoryWeight('equal', 12)).toBe(1)
    expect(repositoryWeight('equal', 0)).toBe(1)
  })

  it('rejects an unsupported runtime sizing mode', () => {
    expect(() => repositoryWeight('impact' as never, 12)).toThrow(
      'Unsupported size mode: impact',
    )
  })
})
