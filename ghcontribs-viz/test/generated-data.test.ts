import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  parseRepositoryDetails,
  parseVisualizationIndex,
} from '../src/data/validation.ts'

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
})
