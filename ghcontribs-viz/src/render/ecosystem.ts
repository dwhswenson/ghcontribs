import type { ContributionCounts } from '../data/types.ts'
import type { EcosystemLayout, LayoutRect } from '../layout/treemap.ts'
import type { VisualizationSnapshot } from '../model/model.ts'

const COUNT_LABELS: ReadonlyArray<{
  key: keyof ContributionCounts
  short: string
  label: string
}> = [
  { key: 'issues', short: 'I', label: 'issues' },
  { key: 'pull_requests', short: 'PR', label: 'pull requests' },
  { key: 'reviews', short: 'R', label: 'reviews' },
  { key: 'comments', short: 'C', label: 'comments' },
]

function positionWithin(
  element: HTMLElement,
  rect: LayoutRect,
  parent: LayoutRect,
): void {
  element.style.left = `${((rect.x - parent.x) / parent.width) * 100}%`
  element.style.top = `${((rect.y - parent.y) / parent.height) * 100}%`
  element.style.width = `${(rect.width / parent.width) * 100}%`
  element.style.height = `${(rect.height / parent.height) * 100}%`
}

function countsDescription(counts: ContributionCounts): string {
  return COUNT_LABELS.map(({ key, label }) => `${counts[key]} ${label}`).join(', ')
}

function countList(counts: ContributionCounts): HTMLElement {
  const list = document.createElement('dl')
  list.className = 'ghc-counts'
  for (const { key, short, label } of COUNT_LABELS) {
    const item = document.createElement('div')
    item.className = `ghc-count ghc-count--${key}`
    item.title = label

    const term = document.createElement('dt')
    term.textContent = short
    const value = document.createElement('dd')
    value.dataset.count = key
    value.textContent = String(counts[key])
    item.append(term, value)
    list.append(item)
  }
  return list
}

function updateCountList(list: HTMLElement, counts: ContributionCounts): void {
  for (const { key } of COUNT_LABELS) {
    const value = list.querySelector<HTMLElement>(`[data-count="${key}"]`)
    if (value !== null) value.textContent = String(counts[key])
  }
}

function createOwnerElement(ownerName: string): HTMLElement {
  const owner = document.createElement('section')
  owner.className = 'ghc-owner'
  owner.dataset.owner = ownerName

  const name = document.createElement('h2')
  name.className = 'ghc-owner__name'
  owner.append(name)
  return owner
}

function createRepositoryElement(key: string): HTMLElement {
  const tile = document.createElement('article')
  tile.className = 'ghc-repository'
  tile.dataset.repositoryKey = key

  const name = document.createElement('h3')
  name.className = 'ghc-repository__name'
  tile.append(name, countList({ issues: 0, pull_requests: 0, reviews: 0, comments: 0 }))
  return tile
}

export function renderEcosystem(
  target: HTMLElement,
  snapshot: VisualizationSnapshot,
  layout: EcosystemLayout,
): void {
  let ecosystem = target.querySelector<HTMLElement>(':scope > .ghc-ecosystem')
  if (ecosystem === null) {
    ecosystem = document.createElement('div')
    ecosystem.className = 'ghc-ecosystem'
    ecosystem.setAttribute('role', 'group')
    target.replaceChildren(ecosystem)
  }
  ecosystem.setAttribute('role', 'group')
  ecosystem.setAttribute(
    'aria-label',
    `${snapshot.user}'s GitHub contributions: ${countsDescription(snapshot.counts)}`,
  )
  ecosystem.style.height = `${layout.height}px`
  const canvas = { x: 0, y: 0, width: layout.width, height: layout.height }
  const remainingOwners = new Map(
    Array.from(ecosystem.querySelectorAll<HTMLElement>(':scope > .ghc-owner')).map(
      (owner) => [owner.dataset.owner!, owner],
    ),
  )

  for (const ownerLayout of layout.owners) {
    const ownerNameText = ownerLayout.owner.owner
    const owner = remainingOwners.get(ownerNameText) ?? createOwnerElement(ownerNameText)
    remainingOwners.delete(ownerNameText)
    owner.setAttribute(
      'aria-label',
      `${ownerNameText}: ${countsDescription(ownerLayout.owner.counts)}`,
    )
    positionWithin(owner, ownerLayout, canvas)

    const ownerName = owner.querySelector<HTMLElement>(':scope > .ghc-owner__name')!
    ownerName.textContent = ownerNameText
    ownerName.classList.toggle(
      'ghc-visually-hidden',
      ownerLayout.width < 72 || ownerLayout.height < 58,
    )
    const remainingRepositories = new Map(
      Array.from(
        owner.querySelectorAll<HTMLElement>(':scope > .ghc-repository'),
      ).map((repository) => [repository.dataset.repositoryKey!, repository]),
    )

    for (const repositoryLayout of ownerLayout.repositories) {
      const { repository } = repositoryLayout
      const tile = remainingRepositories.get(repository.key) ??
        createRepositoryElement(repository.key)
      remainingRepositories.delete(repository.key)
      tile.setAttribute(
        'aria-label',
        `${repository.key}: ${countsDescription(repository.counts)}`,
      )
      positionWithin(tile, repositoryLayout, ownerLayout)
      tile.classList.toggle(
        'ghc-repository--compact',
        repositoryLayout.width < 32 || repositoryLayout.height < 32,
      )

      const name = tile.querySelector<HTMLElement>(':scope > .ghc-repository__name')!
      name.textContent = repository.name
      name.classList.toggle(
        'ghc-visually-hidden',
        repositoryLayout.width < 92 || repositoryLayout.height < 45,
      )

      const counts = tile.querySelector<HTMLElement>(':scope > .ghc-counts')!
      updateCountList(counts, repository.counts)
      counts.classList.toggle(
        'ghc-visually-hidden',
        repositoryLayout.width < 145 || repositoryLayout.height < 82,
      )
      owner.append(tile)
    }
    for (const repository of remainingRepositories.values()) repository.remove()
    ecosystem.append(owner)
  }
  for (const owner of remainingOwners.values()) owner.remove()
  ecosystem.classList.add('ghc-ecosystem--layout-ready')
}

export function renderLoading(target: HTMLElement): void {
  const status = document.createElement('p')
  status.className = 'ghc-status'
  status.setAttribute('role', 'status')
  status.textContent = 'Loading contribution data…'
  target.replaceChildren(status)
}

export function renderLoadError(target: HTMLElement, error: unknown): void {
  const panel = document.createElement('div')
  panel.className = 'ghc-status ghc-status--error'
  panel.setAttribute('role', 'alert')

  const title = document.createElement('strong')
  title.textContent = 'Contribution data could not be loaded.'
  const detail = document.createElement('span')
  detail.textContent = error instanceof Error ? error.message : String(error)
  panel.append(title, detail)
  target.replaceChildren(panel)
}
