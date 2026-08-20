import { describe, expect, it, vi } from 'vitest'

import { DataLoadError, loadVisualizationIndex } from '../src/data/load.ts'
import { UnsupportedSchemaVersionError } from '../src/data/validation.ts'
import { validIndex } from './fixtures.ts'

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
