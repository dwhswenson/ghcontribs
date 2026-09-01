import type { ContributionCounts } from '../data/types.ts'
import type { EcosystemLayout, LayoutRect } from '../layout/treemap.ts'
import type { VisualizationSnapshot } from '../model/model.ts'
import type { InteractionSnapshot, InteractionTarget } from '../interaction/state.ts'

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
  const focusControl = document.createElement('button')
  focusControl.type = 'button'
  focusControl.className = 'ghc-owner__focus'
  focusControl.dataset.interactionKind = 'owner'
  focusControl.dataset.owner = ownerName
  focusControl.tabIndex = 0
  name.append(focusControl)
  owner.append(name)
  return owner
}

function createRepositoryElement(key: string): HTMLElement {
  const tile = document.createElement('article')
  tile.className = 'ghc-repository'
  tile.dataset.repositoryKey = key
  tile.dataset.interactionKind = 'repository'
  tile.tabIndex = 0

  const name = document.createElement('h3')
  name.className = 'ghc-repository__name'
  tile.append(name, countList({ issues: 0, pull_requests: 0, reviews: 0, comments: 0 }))
  return tile
}

export interface EcosystemElements {
  readonly shell: HTMLElement
  readonly toolbar: HTMLElement
  readonly backButton: HTMLButtonElement
  readonly ecosystem: HTMLElement
  readonly summary: HTMLElement
}

function ensureEcosystemElements(target: HTMLElement): EcosystemElements {
  let shell = target.querySelector<HTMLElement>(':scope > .ghc-visualization')
  if (shell === null) {
    shell = document.createElement('div')
    shell.className = 'ghc-visualization'

    const toolbar = document.createElement('div')
    toolbar.className = 'ghc-toolbar'
    const toolbarHint = document.createElement('span')
    toolbarHint.className = 'ghc-toolbar__hint'
    toolbarHint.textContent = 'Use Tab to explore; press Enter or Space to focus an owner.'
    const backButton = document.createElement('button')
    backButton.type = 'button'
    backButton.className = 'ghc-back'
    backButton.dataset.action = 'overview'
    backButton.textContent = 'Back to overview'
    backButton.hidden = true
    toolbar.append(toolbarHint, backButton)

    const ecosystem = document.createElement('div')
    ecosystem.className = 'ghc-ecosystem'
    ecosystem.setAttribute('role', 'group')

    const summary = document.createElement('aside')
    summary.className = 'ghc-summary'
    summary.setAttribute('aria-label', 'Contribution summary')
    summary.setAttribute('aria-live', 'polite')
    summary.setAttribute('aria-atomic', 'true')
    shell.append(toolbar, ecosystem, summary)
    target.replaceChildren(shell)
  }

  return {
    shell,
    toolbar: shell.querySelector<HTMLElement>(':scope > .ghc-toolbar')!,
    backButton: shell.querySelector<HTMLButtonElement>('.ghc-back')!,
    ecosystem: shell.querySelector<HTMLElement>(':scope > .ghc-ecosystem')!,
    summary: shell.querySelector<HTMLElement>(':scope > .ghc-summary')!,
  }
}

export function renderEcosystem(
  target: HTMLElement,
  snapshot: VisualizationSnapshot,
  layout: EcosystemLayout,
  focusedOwner: string | null = null,
): EcosystemElements {
  const elements = ensureEcosystemElements(target)
  const { ecosystem } = elements
  ecosystem.setAttribute('role', 'group')
  ecosystem.setAttribute(
    'aria-label',
    `${snapshot.user}'s GitHub contributions: ${countsDescription(snapshot.counts)}`,
  )
  ecosystem.style.height = `${layout.height}px`
  ecosystem.classList.toggle('ghc-ecosystem--owner-focused', focusedOwner !== null)
  elements.backButton.hidden = focusedOwner === null
  elements.toolbar.querySelector<HTMLElement>('.ghc-toolbar__hint')!.hidden =
    focusedOwner !== null
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
    const isFocusTarget = ownerNameText === focusedOwner
    const isFocusHidden = focusedOwner !== null && !isFocusTarget
    owner.classList.toggle('ghc-owner--focus-target', isFocusTarget)
    owner.classList.toggle('ghc-owner--focus-hidden', isFocusHidden)
    owner.inert = isFocusHidden
    if (isFocusHidden) owner.setAttribute('aria-hidden', 'true')
    else owner.removeAttribute('aria-hidden')
    positionWithin(owner, ownerLayout, canvas)

    const ownerName = owner.querySelector<HTMLElement>(':scope > .ghc-owner__name')!
    const ownerFocus = ownerName.querySelector<HTMLButtonElement>(
      ':scope > .ghc-owner__focus',
    )!
    ownerFocus.textContent = ownerNameText
    ownerFocus.setAttribute('aria-label', `Focus ${ownerNameText}`)
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
      tile.dataset.owner = repository.owner
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
      if (tile.parentElement !== owner) owner.append(tile)
    }
    for (const repository of remainingRepositories.values()) repository.remove()
    if (owner.parentElement !== ecosystem) ecosystem.append(owner)
  }
  for (const owner of remainingOwners.values()) owner.remove()
  ecosystem.classList.add('ghc-ecosystem--layout-ready')
  return elements
}

const CONTRIBUTION_TYPE_LABELS: Record<string, string> = {
  issues: 'issues',
  pull_requests: 'pull requests',
  reviews: 'reviews',
  comments: 'comments',
}

function sameTarget(left: InteractionTarget | null, right: InteractionTarget): boolean {
  if (left === null || left.kind !== right.kind || left.owner !== right.owner) return false
  if (left.kind === 'owner') return true
  return right.kind === 'repository' && left.key === right.key
}

export function renderInteraction(
  target: HTMLElement,
  snapshot: VisualizationSnapshot,
  interaction: InteractionSnapshot,
): void {
  const elements = ensureEcosystemElements(target)
  const owners = Array.from(
    elements.ecosystem.querySelectorAll<HTMLElement>(':scope > .ghc-owner'),
  )
  const active = interaction.active
  elements.ecosystem.classList.toggle('ghc-ecosystem--has-active', active !== null)
  elements.ecosystem.classList.toggle(
    'ghc-ecosystem--has-active-repository',
    active?.kind === 'repository',
  )

  for (const owner of owners) {
    const ownerTarget: InteractionTarget = {
      kind: 'owner', owner: owner.dataset.owner!,
    }
    const ownerIsActive = sameTarget(active, ownerTarget)
    const ownerContainsActiveRepository = active?.kind === 'repository' &&
      active.owner === owner.dataset.owner
    owner.classList.toggle('ghc-owner--active', ownerIsActive)
    owner.classList.toggle('ghc-owner--related', ownerContainsActiveRepository)
    for (const repository of owner.querySelectorAll<HTMLElement>(
      ':scope > .ghc-repository',
    )) {
      const repositoryTarget: InteractionTarget = {
        kind: 'repository',
        owner: repository.dataset.owner!,
        key: repository.dataset.repositoryKey!,
      }
      repository.classList.toggle(
        'ghc-repository--active',
        sameTarget(active, repositoryTarget),
      )
    }
  }

  let title = 'All repositories'
  let counts = snapshot.counts
  if (active?.kind === 'owner') {
    const owner = snapshot.owners.find((candidate) => candidate.owner === active.owner)
    if (owner !== undefined) {
      title = owner.owner
      counts = owner.counts
    }
  } else if (active?.kind === 'repository') {
    const repository = snapshot.owners
      .find((owner) => owner.owner === active.owner)
      ?.repositories.find((candidate) => candidate.key === active.key)
    if (repository !== undefined) {
      title = repository.key
      counts = repository.counts
    }
  }

  const heading = document.createElement('h2')
  heading.className = 'ghc-summary__title'
  heading.textContent = title
  const meta = document.createElement('p')
  meta.className = 'ghc-summary__meta'
  const typeNames = snapshot.contributionTypes.map(
    (type) => CONTRIBUTION_TYPE_LABELS[type],
  )
  meta.textContent = `${snapshot.monthRange.from} through ${snapshot.monthRange.through} · ${
    typeNames.length === 0 ? 'no contribution types selected' : typeNames.join(', ')
  }`
  elements.summary.replaceChildren(heading, meta, countList(counts))
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
