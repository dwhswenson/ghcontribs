import { describe, expect, it } from 'vitest'

import {
  DataValidationError,
  UnsupportedSchemaVersionError,
  parseRepositoryDetails,
  parseVisualizationIndex,
} from '../src/data/validation.ts'
import { validDetails, validIndex } from './fixtures.ts'

function clone<T>(value: T): T {
  return structuredClone(value)
}

describe('visualization index validation', () => {
  it('accepts a valid index', () => {
    expect(parseVisualizationIndex(validIndex)).toBe(validIndex)
  })

  it('reports unsupported schema versions explicitly', () => {
    const value = { ...validIndex, schema_version: 2 }
    expect(() => parseVisualizationIndex(value)).toThrow(
      UnsupportedSchemaVersionError,
    )
  })

  it.each([
    ['invalid month', (value: Record<string, any>) => (value.source.first_month = '2024-13')],
    ['invalid key', (value: Record<string, any>) => (value.owners[0].repositories[0].key = 'example')],
    ['negative count', (value: Record<string, any>) => (value.owners[0].repositories[0].contributions.total.issues = -1)],
    ['missing count', (value: Record<string, any>) => delete value.owners[0].repositories[0].contributions.total.comments],
    ['unknown property', (value: Record<string, any>) => (value.unexpected = true)],
  ])('rejects an index with an %s', (_label, mutate) => {
    const value: Record<string, any> = clone(validIndex)
    mutate(value)
    expect(() => parseVisualizationIndex(value)).toThrow(DataValidationError)
  })
})

describe('repository detail validation', () => {
  it('accepts all four contribution variants', () => {
    expect(parseRepositoryDetails(validDetails)).toBe(validDetails)
  })

  it('rejects malformed nested contribution context', () => {
    const value: Record<string, any> = clone(validDetails)
    delete value.contributions[2].pr.merged
    expect(() => parseRepositoryDetails(value)).toThrow(DataValidationError)
  })

  it('rejects unknown contribution properties', () => {
    const value: Record<string, any> = clone(validDetails)
    value.contributions[0].body = 'not part of schema v1'
    expect(() => parseRepositoryDetails(value)).toThrow(DataValidationError)
  })
})
