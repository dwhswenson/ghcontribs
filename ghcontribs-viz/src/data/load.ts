import type { RepositoryDetails, RepositorySummary, VisualizationIndex } from './types.ts'
import { parseRepositoryDetails, parseVisualizationIndex } from './validation.ts'

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

export class RepositoryDetailsLoader {
  readonly #indexUrl: URL
  readonly #fetcher: Fetcher
  readonly #cache = new Map<string, RepositoryDetails>()

  constructor(indexUrl: string | URL, fetcher: Fetcher = (input) => fetch(input)) {
    this.#indexUrl = new URL(String(indexUrl), globalThis.document?.baseURI ?? 'http://localhost/')
    this.#fetcher = fetcher
  }

  async load(
    owner: string,
    repository: Pick<RepositorySummary, 'key' | 'name' | 'details_path'>,
  ): Promise<RepositoryDetails> {
    const cached = this.#cache.get(repository.key)
    if (cached !== undefined) return cached

    const url = new URL(repository.details_path, this.#indexUrl)
    let response: Response
    try {
      response = await this.#fetcher(url)
    } catch (error) {
      throw new DataLoadError(`Unable to fetch repository details from ${url}`, { cause: error })
    }
    if (!response.ok) {
      throw new DataLoadError(
        `Unable to fetch repository details from ${url}: ${response.status} ${response.statusText}`.trim(),
      )
    }

    let value: unknown
    try {
      value = await response.json()
    } catch (error) {
      throw new DataLoadError(`Invalid JSON in repository details from ${url}`, { cause: error })
    }
    const details = parseRepositoryDetails(value)
    if (details.key !== repository.key || details.owner !== owner || details.name !== repository.name) {
      throw new DataLoadError(`Repository details from ${url} do not match ${repository.key}`)
    }
    this.#cache.set(repository.key, details)
    return details
  }
}
