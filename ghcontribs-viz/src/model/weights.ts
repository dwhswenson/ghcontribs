export type SizeMode = 'contributions' | 'equal'
export type ContributionWeightingName = 'linear' | 'sqrt' | 'log' | 'asinh'
export type ContributionWeightFunction = (activeContributionCount: number) => number
export type ContributionWeighting =
  | ContributionWeightingName
  | ContributionWeightFunction

function unsupportedSizeMode(mode: never): never {
  throw new RangeError(`Unsupported size mode: ${String(mode)}`)
}

/**
 * Convert the current contribution-derived activity into a layout weight.
 *
 * This policy is deliberately separate from count aggregation: contribution
 * count is the information available in the v1 dataset, not a permanent
 * definition of repository importance or impact. Future modes can use other
 * signals without changing the filtered counts consumed by the renderer.
 */
export function repositoryWeight(
  mode: SizeMode,
  activeContributionCount: number,
  weighting: ContributionWeighting = 'sqrt',
): number {
  switch (mode) {
    case 'contributions':
      return contributionWeight(activeContributionCount, weighting)
    case 'equal':
      return 1
    default:
      return unsupportedSizeMode(mode)
  }
}

export function contributionWeight(
  activeContributionCount: number,
  weighting: ContributionWeighting,
): number {
  if (!(activeContributionCount >= 0) || !Number.isFinite(activeContributionCount)) {
    throw new RangeError('Contribution count must be a finite non-negative number')
  }
  if (typeof weighting === 'function') {
    const result = weighting(activeContributionCount)
    if (!(result >= 0) || !Number.isFinite(result)) {
      throw new RangeError(
        'Custom contribution weighting must return a finite non-negative number',
      )
    }
    return result
  }
  switch (weighting) {
    case 'linear':
      return activeContributionCount
    case 'sqrt':
      return Math.sqrt(activeContributionCount)
    case 'log':
      return Math.log1p(activeContributionCount)
    case 'asinh':
      return Math.asinh(activeContributionCount)
    default:
      throw new RangeError(`Unsupported contribution weighting: ${String(weighting)}`)
  }
}
