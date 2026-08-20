import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  parseRepositoryDetails,
  parseVisualizationIndex,
} from '../src/data/validation.ts'
import { VisualizationModel } from '../src/model/model.ts'
import { addCounts, totalCount, zeroCounts } from '../src/model/counts.ts'

const datasetDirectory = process.env.GHCONTRIBS_VIZ_DATA

describe.runIf(datasetDirectory)('generated visualization data', () => {
  it('validates the index and every referenced repository detail', async () => {
    const indexPath = join(datasetDirectory!, 'index.json')
    const index = parseVisualizationIndex(
      JSON.parse(await readFile(indexPath, 'utf8')) as unknown,
    )

    let repositoryCount = 0
    for (const owner of index.owners) {
      for (const repository of owner.repositories) {
        const detailPath = join(
          datasetDirectory!,
          'repos',
          owner.owner,
          `${repository.name}.json`,
        )
        const details = parseRepositoryDetails(
          JSON.parse(await readFile(detailPath, 'utf8')) as unknown,
        )
        expect(details.key).toBe(repository.key)
        repositoryCount += 1
      }
    }

    expect(repositoryCount).toBeGreaterThan(0)
  })

  it('builds a complete initial model whose totals reconcile with the index', async () => {
    const indexPath = join(datasetDirectory!, 'index.json')
    const index = parseVisualizationIndex(
      JSON.parse(await readFile(indexPath, 'utf8')) as unknown,
    )
    const snapshot = new VisualizationModel(index).getSnapshot()

    let expectedCounts = zeroCounts()
    let expectedRepositoryCount = 0
    for (const owner of index.owners) {
      for (const repository of owner.repositories) {
        expectedCounts = addCounts(expectedCounts, repository.contributions.total)
        expectedRepositoryCount += 1
      }
    }

    expect(snapshot.owners).toHaveLength(index.owners.length)
    expect(
      snapshot.owners.reduce(
        (count, owner) => count + owner.repositories.length,
        0,
      ),
    ).toBe(expectedRepositoryCount)
    expect(snapshot.counts).toEqual(expectedCounts)
    expect(snapshot.totalContributions).toBe(totalCount(expectedCounts))
  })
})
