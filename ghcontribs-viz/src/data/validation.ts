import Ajv2020, { type AnySchema, type ErrorObject } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

import contributionsSchema from '../../../schemas/v1/contributions.schema.json'
import repositoryDetailsSchema from '../../../schemas/v1/repository-details.schema.json'
import visualizationIndexSchema from '../../../schemas/v1/visualization-index.schema.json'
import type { RepositoryDetails, VisualizationIndex } from './types.ts'

const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv)
ajv.addSchema(contributionsSchema as AnySchema)

const validateIndex = ajv.compile<VisualizationIndex>(
  visualizationIndexSchema as AnySchema,
)
const validateDetails = ajv.compile<RepositoryDetails>(
  repositoryDetailsSchema as AnySchema,
)

export class UnsupportedSchemaVersionError extends Error {
  constructor(version: unknown) {
    super(`Unsupported visualization schema version: ${String(version)}`)
    this.name = 'UnsupportedSchemaVersionError'
  }
}

export class DataValidationError extends Error {
  readonly errors: ErrorObject[]

  constructor(dataKind: string, errors: ErrorObject[]) {
    const explanation = errors
      .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
      .join('; ')
    super(`Invalid ${dataKind}: ${explanation}`)
    this.name = 'DataValidationError'
    this.errors = errors
  }
}

function rejectUnsupportedVersion(value: unknown): void {
  if (
    typeof value === 'object' &&
    value !== null &&
    'schema_version' in value &&
    value.schema_version !== 1
  ) {
    throw new UnsupportedSchemaVersionError(value.schema_version)
  }
}

export function parseVisualizationIndex(value: unknown): VisualizationIndex {
  rejectUnsupportedVersion(value)
  if (!validateIndex(value)) {
    throw new DataValidationError(
      'visualization index',
      validateIndex.errors ?? [],
    )
  }
  return value as VisualizationIndex
}

export function parseRepositoryDetails(value: unknown): RepositoryDetails {
  rejectUnsupportedVersion(value)
  if (!validateDetails(value)) {
    throw new DataValidationError(
      'repository details',
      validateDetails.errors ?? [],
    )
  }
  return value as RepositoryDetails
}
