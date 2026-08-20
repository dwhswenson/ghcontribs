export type SizeMode = 'contributions' | 'equal'

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
): number {
  switch (mode) {
    case 'contributions':
      return activeContributionCount
    case 'equal':
      return 1
  }
}
