import type { VisualizationIndex } from './types.ts'
import { parseVisualizationIndex } from './validation.ts'

type Fetcher = (input: RequestInfo | URL) => Promise<Response>

export class DataLoadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DataLoadError'
  }
}

export async function loadVisualizationIndex(
  dataUrl: string | URL,
  fetcher: Fetcher = fetch,
): Promise<VisualizationIndex> {
  let response: Response
  try {
    response = await fetcher(dataUrl)
  } catch (error) {
    throw new DataLoadError(`Unable to fetch visualization index from ${dataUrl}`, {
      cause: error,
    })
  }

  if (!response.ok) {
    throw new DataLoadError(
      `Unable to fetch visualization index from ${dataUrl}: ` +
        `${response.status} ${response.statusText}`.trim(),
    )
  }

  let value: unknown
  try {
    value = await response.json()
  } catch (error) {
    throw new DataLoadError(`Invalid JSON in visualization index from ${dataUrl}`, {
      cause: error,
    })
  }
  return parseVisualizationIndex(value)
}
