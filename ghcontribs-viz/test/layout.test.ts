import { describe, expect, it } from 'vitest'

import type { VisualizationIndex } from '../src/data/types.ts'
import { layoutEcosystem, type LayoutRect } from '../src/layout/treemap.ts'
import { VisualizationModel } from '../src/model/model.ts'

const index: VisualizationIndex = {
  schema_version: 1,
  user: 'octocat',
  source: { first_month: '2024-01', last_month: '2024-01' },
  owners: [
    {
      owner: 'Alpha',
      repositories: [
        {
          key: 'Alpha/large',
          name: 'large',
          contributions: {
            total: { issues: 8, pull_requests: 0, reviews: 0, comments: 0 },
            by_month: {
              '2024-01': { issues: 8, pull_requests: 0, reviews: 0, comments: 0 },
            },
          },
        },
        {
          key: 'Alpha/small',
          name: 'small',
          contributions: {
            total: { issues: 2, pull_requests: 0, reviews: 0, comments: 0 },
            by_month: {
              '2024-01': { issues: 2, pull_requests: 0, reviews: 0, comments: 0 },
            },
          },
        },
      ],
    },
    {
      owner: 'Beta',
      repositories: [
        {
          key: 'Beta/zero',
          name: 'zero',
          contributions: {
            total: { issues: 0, pull_requests: 0, reviews: 0, comments: 0 },
            by_month: {},
          },
        },
      ],
    },
  ],
}

function area(rect: LayoutRect): number {
  return rect.width * rect.height
}

function overlaps(left: LayoutRect, right: LayoutRect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  )
}

function contains(parent: LayoutRect, child: LayoutRect): boolean {
  return (
    child.x >= parent.x &&
    child.y >= parent.y &&
    child.x + child.width <= parent.x + parent.width + Number.EPSILON &&
    child.y + child.height <= parent.y + parent.height + Number.EPSILON
  )
}

describe('layoutEcosystem', () => {
  it('is deterministic and preserves model ordering', () => {
    const snapshot = new VisualizationModel(structuredClone(index)).getSnapshot()
    const first = layoutEcosystem(snapshot)
    const second = layoutEcosystem(snapshot)
    expect(second).toEqual(first)
    expect(first.owners.map(({ owner }) => owner.owner)).toEqual(['Alpha', 'Beta'])
    expect(first.owners[0]?.repositories.map(({ repository }) => repository.key)).toEqual([
      'Alpha/large',
      'Alpha/small',
    ])
  })

  it('contains non-overlapping owners and repositories', () => {
    const layout = layoutEcosystem(
      new VisualizationModel(structuredClone(index)).getSnapshot(),
    )
    expect(overlaps(layout.owners[0]!, layout.owners[1]!)).toBe(false)
    for (const owner of layout.owners) {
      for (const repository of owner.repositories) {
        expect(contains(owner, repository)).toBe(true)
      }
      for (let left = 0; left < owner.repositories.length; left += 1) {
        for (let right = left + 1; right < owner.repositories.length; right += 1) {
          expect(overlaps(owner.repositories[left]!, owner.repositories[right]!)).toBe(false)
        }
      }
    }
  })

  it('uses contribution weights and keeps zero-count repositories visible', () => {
    const layout = layoutEcosystem(
      new VisualizationModel(structuredClone(index)).getSnapshot(),
    )
    const [large, small] = layout.owners[0]!.repositories
    const zero = layout.owners[1]!.repositories[0]!
    expect(area(large!) / area(small!)).toBeCloseTo(4)
    expect(zero.width).toBeGreaterThan(0)
    expect(zero.height).toBeGreaterThan(0)
  })

  it('gives repositories equal area in equal sizing mode', () => {
    const model = new VisualizationModel(structuredClone(index))
    model.setSizeMode('equal')
    const layout = layoutEcosystem(model.getSnapshot())
    const [large, small] = layout.owners[0]!.repositories
    expect(area(large!)).toBeCloseTo(area(small!))
  })

  it('gives multiple owners without repositories finite visible regions', () => {
    const emptyOwnersIndex: VisualizationIndex = {
      schema_version: 1,
      user: 'octocat',
      source: { first_month: '2024-01', last_month: '2024-01' },
      owners: [
        { owner: 'EmptyAlpha', repositories: [] },
        { owner: 'EmptyBeta', repositories: [] },
      ],
    }
    const layout = layoutEcosystem(
      new VisualizationModel(emptyOwnersIndex).getSnapshot(),
    )

    expect(layout.owners).toHaveLength(2)
    for (const owner of layout.owners) {
      expect([owner.x, owner.y, owner.width, owner.height].every(Number.isFinite)).toBe(
        true,
      )
      expect(owner.width).toBeGreaterThan(0)
      expect(owner.height).toBeGreaterThan(0)
      expect(owner.repositories).toEqual([])
    }
  })

  it('rejects non-positive dimensions', () => {
    const snapshot = new VisualizationModel(structuredClone(index)).getSnapshot()
    expect(() => layoutEcosystem(snapshot, 0, 800)).toThrow('must be positive')
  })
})
