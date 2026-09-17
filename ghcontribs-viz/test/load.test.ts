import { describe, expect, it, vi } from 'vitest'

import { DataLoadError, loadVisualizationIndex, RepositoryDetailsLoader } from '../src/data/load.ts'
import { UnsupportedSchemaVersionError } from '../src/data/validation.ts'
import { validDetails, validIndex } from './fixtures.ts'

describe('loadVisualizationIndex', () => {
  it('fetches, validates, and returns an index', async () => {
    const fetcher = vi.fn(async () => Response.json(validIndex))
    await expect(loadVisualizationIndex('/data/index.json', fetcher)).resolves.toEqual(
      validIndex,
    )
    expect(fetcher).toHaveBeenCalledWith('/data/index.json')
  })

  it('reports network failures', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('offline')
    })
    await expect(loadVisualizationIndex('/data/index.json', fetcher)).rejects.toThrow(
      DataLoadError,
    )
  })

  it('reports unsuccessful HTTP responses', async () => {
    const fetcher = vi.fn(
      async () => new Response(null, { status: 503, statusText: 'Unavailable' }),
    )
    await expect(loadVisualizationIndex('/data/index.json', fetcher)).rejects.toThrow(
      '503 Unavailable',
    )
  })

  it('reports malformed JSON', async () => {
    const fetcher = vi.fn(
      async () => new Response('{broken', { headers: { 'content-type': 'application/json' } }),
    )
    await expect(loadVisualizationIndex('/data/index.json', fetcher)).rejects.toThrow(
      'Invalid JSON',
    )
  })

  it('preserves schema validation errors', async () => {
    const fetcher = vi.fn(async () => Response.json({ ...validIndex, schema_version: 9 }))
    await expect(loadVisualizationIndex('/data/index.json', fetcher)).rejects.toThrow(
      UnsupportedSchemaVersionError,
    )
  })
})

describe('RepositoryDetailsLoader', () => {
  const repository = validIndex.owners[0]!.repositories[0]!

  it('resolves the emitted path relative to the index and caches success', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL) => Response.json(validDetails))
    const loader = new RepositoryDetailsLoader('https://data.example/archive/index.json', fetcher)
    await expect(loader.load('ExampleOrg', repository)).resolves.toEqual(validDetails)
    await loader.load('ExampleOrg', repository)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(String(fetcher.mock.calls[0]![0])).toBe(
      `https://data.example/archive/${repository.details_path}`,
    )
  })

  it('rejects identity and schema mismatches without caching them', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ ...validDetails, key: 'Other/repo' }))
      .mockResolvedValueOnce(Response.json({ ...validDetails, schema_version: 2 }))
      .mockResolvedValueOnce(Response.json(validDetails))
    const loader = new RepositoryDetailsLoader('/data/index.json', fetcher)
    await expect(loader.load('ExampleOrg', repository)).rejects.toThrow('do not match')
    await expect(loader.load('ExampleOrg', repository)).rejects.toThrow('Unsupported')
    await expect(loader.load('ExampleOrg', repository)).resolves.toEqual(validDetails)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('retries after HTTP and network failures', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json(validDetails))
    const loader = new RepositoryDetailsLoader('/data/index.json', fetcher)
    await expect(loader.load('ExampleOrg', repository)).rejects.toThrow(DataLoadError)
    await expect(loader.load('ExampleOrg', repository)).rejects.toThrow('503')
    await expect(loader.load('ExampleOrg', repository)).resolves.toEqual(validDetails)
  })
})
