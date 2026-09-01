import type {
  OwnerViewModel,
  RepositoryViewModel,
  VisualizationSnapshot,
} from '../model/model.ts'

export interface LayoutRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface RepositoryLayout extends LayoutRect {
  readonly repository: RepositoryViewModel
}

export interface OwnerLayout extends LayoutRect {
  readonly owner: OwnerViewModel
  readonly repositories: readonly RepositoryLayout[]
}

export interface EcosystemLayout {
  readonly width: number
  readonly height: number
  readonly owners: readonly OwnerLayout[]
}

export interface LayoutOptions {
  readonly focusedOwner?: string | null
}

interface WeightedItem<T> {
  readonly value: T
  readonly weight: number
}

interface PositionedItem<T> extends LayoutRect {
  readonly value: T
}

const OUTER_PADDING = 8
const OWNER_GAP = 8
const REPOSITORY_GAP = 4
const OWNER_INSET = 7
const OWNER_HEADER_HEIGHT = 28
export const MINIMUM_REPOSITORY_SIZE = 4

interface PartitionOptions {
  readonly gap: number
  readonly minimumSize: number
}

function effectiveWeight(weight: number): number {
  return Math.max(Number.isFinite(weight) ? weight : 0, 0)
}

function allocateMinimumAreas<T>(
  items: readonly WeightedItem<T>[],
  rect: LayoutRect,
  minimumArea: (item: T) => number,
): WeightedItem<T>[] {
  if (items.length === 0) return []
  const availableArea = rect.width * rect.height
  const requestedFloors = items.map((item) => minimumArea(item.value))
  const requestedFloorTotal = requestedFloors.reduce((sum, area) => sum + area, 0)
  const floorScale = requestedFloorTotal > availableArea
    ? availableArea / requestedFloorTotal
    : 1
  const floorAreas = requestedFloors.map((area) => area * floorScale)
  const remainingArea = Math.max(
    0,
    availableArea - floorAreas.reduce((sum, area) => sum + area, 0),
  )
  const semanticWeights = items.map((item) => effectiveWeight(item.weight))
  const maximumSemanticWeight = semanticWeights.reduce(
    (maximum, weight) => Math.max(maximum, weight),
    0,
  )
  const normalizedSemanticWeights = maximumSemanticWeight > 0
    ? semanticWeights.map((weight) => weight / maximumSemanticWeight)
    : semanticWeights
  const semanticTotal = normalizedSemanticWeights.reduce(
    (sum, weight) => sum + weight,
    0,
  )

  return items.map((item, index) => ({
    value: item.value,
    weight: floorAreas[index]! + remainingArea * (
      semanticTotal > 0
        ? normalizedSemanticWeights[index]! / semanticTotal
        : 1 / items.length
    ),
  }))
}

function inset(rect: LayoutRect, amount: number): LayoutRect {
  const insetX = Math.min(amount, rect.width / 2)
  const insetY = Math.min(amount, rect.height / 2)
  return {
    x: rect.x + insetX,
    y: rect.y + insetY,
    width: Math.max(0, rect.width - insetX * 2),
    height: Math.max(0, rect.height - insetY * 2),
  }
}

function splitIndex<T>(items: readonly WeightedItem<T>[]): number {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let running = 0
  let bestIndex = 1
  let bestDistance = Number.POSITIVE_INFINITY

  for (let index = 1; index < items.length; index += 1) {
    running += items[index - 1]!.weight
    const distance = Math.abs(total / 2 - running)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestIndex
}

function partition<T>(
  items: readonly WeightedItem<T>[],
  rect: LayoutRect,
  options: PartitionOptions,
): PositionedItem<T>[] {
  if (items.length === 0) return []
  if (items.length === 1) return [{ ...rect, value: items[0]!.value }]

  const index = splitIndex(items)
  const first = items.slice(0, index)
  const second = items.slice(index)
  const firstWeight = first.reduce((sum, item) => sum + item.weight, 0)
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  const ratio = firstWeight / totalWeight
  const splitHorizontally = rect.width >= rect.height
  const span = splitHorizontally ? rect.width : rect.height
  const minimum = Math.min(options.minimumSize, span / 2)
  const gap = Math.min(options.gap, Math.max(0, span - minimum * 2))
  const available = Math.max(0, span - gap)
  const firstSize = Math.min(
    available - minimum,
    Math.max(minimum, available * ratio),
  )
  const secondSize = available - firstSize

  const firstRect: LayoutRect = splitHorizontally
    ? { ...rect, width: firstSize }
    : { ...rect, height: firstSize }
  const secondRect: LayoutRect = splitHorizontally
    ? {
        x: rect.x + firstSize + gap,
        y: rect.y,
        width: secondSize,
        height: rect.height,
      }
    : {
        x: rect.x,
        y: rect.y + firstSize + gap,
        width: rect.width,
        height: secondSize,
      }

  return [
    ...partition(first, firstRect, options),
    ...partition(second, secondRect, options),
  ]
}

function repositoryBounds(ownerRect: LayoutRect): LayoutRect {
  const maximumInset = Math.max(
    0,
    (Math.min(ownerRect.width, ownerRect.height) - MINIMUM_REPOSITORY_SIZE) / 2,
  )
  const inner = inset(ownerRect, Math.min(OWNER_INSET, maximumInset))
  const maximumHeader = Math.max(0, inner.height - MINIMUM_REPOSITORY_SIZE)
  const header = inner.height >= OWNER_HEADER_HEIGHT * 2
    ? Math.min(OWNER_HEADER_HEIGHT, maximumHeader)
    : 0
  return {
    x: inner.x,
    y: inner.y + header,
    width: inner.width,
    height: Math.max(0, inner.height - header),
  }
}

export function layoutEcosystem(
  snapshot: VisualizationSnapshot,
  width = 1200,
  height = 800,
  options: LayoutOptions = {},
): EcosystemLayout {
  if (
    !(width > 0) ||
    !(height > 0) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    throw new RangeError('Layout width and height must be positive and finite')
  }

  const outerPadding = Math.min(OUTER_PADDING, width / 4, height / 4)
  const bounds = inset({ x: 0, y: 0, width, height }, outerPadding)
  const ownerWeights = snapshot.owners.map((owner) => ({
    value: owner,
    weight: effectiveWeight(owner.weight),
  }))
  const owners = allocateMinimumAreas(
    ownerWeights,
    bounds,
    (owner) => Math.max(64, owner.repositories.length * 36),
  )

  const positionedOwners = partition(owners, bounds, {
    gap: OWNER_GAP,
    minimumSize: MINIMUM_REPOSITORY_SIZE,
  })
  return Object.freeze({
    width,
    height,
    owners: Object.freeze(
      positionedOwners.map((positionedOwner): OwnerLayout => {
        const ownerRect = positionedOwner.value.owner === options.focusedOwner
          ? bounds
          : positionedOwner
        const repositoryWeights = positionedOwner.value.repositories.map(
          (repository) => ({
            value: repository,
            weight: effectiveWeight(repository.weight),
          }),
        )
        const repositoryRect = repositoryBounds(ownerRect)
        const repositoryItems = allocateMinimumAreas(
          repositoryWeights,
          repositoryRect,
          () => MINIMUM_REPOSITORY_SIZE ** 2,
        )
        const repositories = partition(
          repositoryItems,
          repositoryRect,
          {
            gap: REPOSITORY_GAP,
            minimumSize: MINIMUM_REPOSITORY_SIZE,
          },
        ).map((repository) =>
          Object.freeze({
            x: repository.x,
            y: repository.y,
            width: repository.width,
            height: repository.height,
            repository: repository.value,
          }),
        )

        return Object.freeze({
          x: ownerRect.x,
          y: ownerRect.y,
          width: ownerRect.width,
          height: ownerRect.height,
          owner: positionedOwner.value,
          repositories: Object.freeze(repositories),
        })
      }),
    ),
  })
}
