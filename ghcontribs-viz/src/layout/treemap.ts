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

function effectiveWeight(weight: number): number {
  return Math.max(Number.isFinite(weight) ? weight : 0, 1)
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
  gap: number,
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
  const available = Math.max(
    0,
    (splitHorizontally ? rect.width : rect.height) - gap,
  )
  const firstSize = available * ratio
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
    ...partition(first, firstRect, gap),
    ...partition(second, secondRect, gap),
  ]
}

function repositoryBounds(ownerRect: LayoutRect): LayoutRect {
  const inner = inset(ownerRect, OWNER_INSET)
  const header = inner.height >= OWNER_HEADER_HEIGHT * 2 ? OWNER_HEADER_HEIGHT : 0
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
): EcosystemLayout {
  if (!(width > 0) || !(height > 0)) {
    throw new RangeError('Layout width and height must be positive')
  }

  const bounds = inset({ x: 0, y: 0, width, height }, OUTER_PADDING)
  const owners = snapshot.owners.map((owner) => ({
    value: owner,
    weight: owner.repositories.reduce(
      (sum, repository) => sum + effectiveWeight(repository.weight),
      0,
    ),
  }))

  const positionedOwners = partition(owners, bounds, OWNER_GAP)
  return Object.freeze({
    width,
    height,
    owners: Object.freeze(
      positionedOwners.map((positionedOwner): OwnerLayout => {
        const repositoryItems = positionedOwner.value.repositories.map(
          (repository) => ({
            value: repository,
            weight: effectiveWeight(repository.weight),
          }),
        )
        const repositories = partition(
          repositoryItems,
          repositoryBounds(positionedOwner),
          REPOSITORY_GAP,
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
          x: positionedOwner.x,
          y: positionedOwner.y,
          width: positionedOwner.width,
          height: positionedOwner.height,
          owner: positionedOwner.value,
          repositories: Object.freeze(repositories),
        })
      }),
    ),
  })
}
