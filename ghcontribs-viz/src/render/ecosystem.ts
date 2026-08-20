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
    value.textContent = String(counts[key])
    item.append(term, value)
    list.append(item)
  }
  return list
}

export function renderEcosystem(
  target: HTMLElement,
  snapshot: VisualizationSnapshot,
  layout: EcosystemLayout,
): void {
  const ecosystem = document.createElement('div')
  ecosystem.className = 'ghc-ecosystem'
  ecosystem.setAttribute('role', 'group')
  ecosystem.setAttribute(
    'aria-label',
    `${snapshot.user}'s GitHub contributions: ${countsDescription(snapshot.counts)}`,
  )
  ecosystem.style.aspectRatio = `${layout.width} / ${layout.height}`
  const canvas = { x: 0, y: 0, width: layout.width, height: layout.height }

  for (const ownerLayout of layout.owners) {
    const owner = document.createElement('section')
    owner.className = 'ghc-owner'
    owner.dataset.owner = ownerLayout.owner.owner
    owner.setAttribute(
      'aria-label',
      `${ownerLayout.owner.owner}: ${countsDescription(ownerLayout.owner.counts)}`,
    )
    positionWithin(owner, ownerLayout, canvas)

    const ownerName = document.createElement('h2')
    ownerName.className = 'ghc-owner__name'
    ownerName.textContent = ownerLayout.owner.owner
    if (ownerLayout.width < 72 || ownerLayout.height < 58) {
      ownerName.classList.add('ghc-visually-hidden')
    }
    owner.append(ownerName)

    for (const repositoryLayout of ownerLayout.repositories) {
      const { repository } = repositoryLayout
      const tile = document.createElement('article')
      tile.className = 'ghc-repository'
      tile.dataset.repositoryKey = repository.key
      tile.setAttribute(
        'aria-label',
        `${repository.key}: ${countsDescription(repository.counts)}`,
      )
      positionWithin(tile, repositoryLayout, ownerLayout)

      const name = document.createElement('h3')
      name.className = 'ghc-repository__name'
      name.textContent = repository.name
      if (repositoryLayout.width < 92 || repositoryLayout.height < 45) {
        name.classList.add('ghc-visually-hidden')
      }
      tile.append(name)

      const counts = countList(repository.counts)
      if (repositoryLayout.width < 145 || repositoryLayout.height < 82) {
        counts.classList.add('ghc-visually-hidden')
      }
      tile.append(counts)
      owner.append(tile)
    }
    ecosystem.append(owner)
  }

  target.replaceChildren(ecosystem)
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
