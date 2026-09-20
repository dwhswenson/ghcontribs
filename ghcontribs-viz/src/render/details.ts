import type { Contribution, RepositoryDetails } from '../data/types.ts'
import {
  RepositoryDetailIndex,
  type IndexedContribution,
} from '../model/detail-index.ts'
import type { RepositoryViewModel, VisualizationSnapshot } from '../model/model.ts'

export type DetailState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: unknown }
  | { readonly kind: 'success'; readonly details: RepositoryDetails }

const TYPE_LABELS: Record<Contribution['contrib_type'], string> = {
  issue: 'Issue',
  pullRequest: 'Pull request',
  pullRequestReview: 'Review',
  issueComment: 'Comment',
}

function targetTitle(contribution: Contribution): string {
  switch (contribution.contrib_type) {
    case 'issue':
    case 'pullRequest':
      return `#${contribution.number} ${contribution.title}`
    case 'pullRequestReview':
      return `PR #${contribution.pr.number} ${contribution.pr.title}`
    case 'issueComment': {
      const target = contribution.issue_or_pr
      return `${target.contrib_type === 'pullRequest' ? 'PR' : 'Issue'} #${target.number} ${target.title}`
    }
  }
}

interface DetailListView {
  readonly details: RepositoryDetails
  readonly index: RepositoryDetailIndex
  readonly list: HTMLOListElement
  readonly empty: HTMLParagraphElement
  readonly rows: Map<IndexedContribution, HTMLLIElement>
  visible: ReadonlySet<IndexedContribution>
}

const detailListViews = new WeakMap<HTMLElement, DetailListView>()

function createDetailRow(contribution: Contribution): HTMLLIElement {
  const item = document.createElement('li')
  item.className = 'ghc-details__item'
  const type = document.createElement('span')
  type.className = 'ghc-details__type'
  type.textContent = TYPE_LABELS[contribution.contrib_type]
  const link = document.createElement('a')
  link.href = contribution.url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.textContent = targetTitle(contribution)
  const date = document.createElement('time')
  date.dateTime = contribution.created
  date.textContent = new Date(contribution.created).toISOString().slice(0, 10)
  item.append(type, link, date)
  return item
}

function createDetailListView(
  status: HTMLElement,
  details: RepositoryDetails,
): DetailListView {
  const index = new RepositoryDetailIndex(details)
  const list = document.createElement('ol')
  list.className = 'ghc-details__list'
  const empty = document.createElement('p')
  empty.textContent = 'No contributions match the active filters.'
  const rows = new Map<IndexedContribution, HTMLLIElement>()
  status.replaceChildren(list, empty)
  return { details, index, list, empty, rows, visible: new Set() }
}

function updateDetailListView(
  view: DetailListView,
  snapshot: VisualizationSnapshot,
): void {
  const selected = view.index.select(snapshot.monthRange, snapshot.contributionTypes)
  const visible = new Set(selected)
  for (const entry of view.visible) {
    if (!visible.has(entry)) view.rows.get(entry)!.remove()
  }
  let nextRow: HTMLLIElement | null = null
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const entry = selected[index]!
    let row = view.rows.get(entry)
    if (row === undefined) {
      row = createDetailRow(entry.contribution)
      view.rows.set(entry, row)
    }
    if (!view.visible.has(entry)) view.list.insertBefore(row, nextRow)
    nextRow = row
  }
  view.visible = visible
  view.list.hidden = visible.size === 0
  view.empty.hidden = visible.size !== 0
}

export function renderDetails(
  root: HTMLElement,
  repository: RepositoryViewModel | null,
  state: DetailState | null,
  snapshot: VisualizationSnapshot,
): void {
  const shell = root.querySelector<HTMLElement>('.ghc-visualization')
  if (shell === null) return
  let panel = shell.querySelector<HTMLElement>('.ghc-details')
  if (repository === null || state === null) {
    panel?.remove()
    return
  }
  if (panel === null) {
    panel = document.createElement('section')
    panel.className = 'ghc-details'
    panel.setAttribute('aria-label', 'Repository details')
    const header = document.createElement('div')
    header.className = 'ghc-details__header'
    const title = document.createElement('h2')
    title.className = 'ghc-details__title'
    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'ghc-details__close'
    close.dataset.action = 'close-details'
    close.textContent = 'Close details'
    header.append(title, close)
    const summary = document.createElement('p')
    summary.className = 'ghc-details__summary'
    const status = document.createElement('div')
    status.className = 'ghc-details__content'
    status.setAttribute('aria-live', 'polite')
    panel.append(header, summary, status)
    const host = shell.querySelector<HTMLElement>(':scope > .ghc-sidebar') ?? shell
    host.append(panel)
  }

  const title = panel.querySelector<HTMLElement>('.ghc-details__title')!
  title.textContent = repository.key
  const summary = panel.querySelector<HTMLElement>('.ghc-details__summary')!
  summary.textContent = `${repository.counts.issues} issues · ${repository.counts.pull_requests} pull requests · ${repository.counts.reviews} reviews · ${repository.counts.comments} comments`
  const status = panel.querySelector<HTMLElement>('.ghc-details__content')!
  status.removeAttribute('role')
  panel.setAttribute('aria-busy', String(state.kind === 'loading'))

  if (state.kind === 'loading') {
    detailListViews.delete(panel)
    status.replaceChildren()
    status.textContent = 'Loading repository details…'
  } else if (state.kind === 'error') {
    detailListViews.delete(panel)
    status.replaceChildren()
    status.setAttribute('role', 'alert')
    const message = document.createElement('p')
    message.textContent = `Repository details could not be loaded: ${state.error instanceof Error ? state.error.message : String(state.error)}`
    const retry = document.createElement('button')
    retry.type = 'button'
    retry.dataset.action = 'retry-details'
    retry.textContent = 'Retry'
    status.append(message, retry)
  } else {
    let view = detailListViews.get(panel)
    if (view?.details !== state.details) {
      view = createDetailListView(status, state.details)
      detailListViews.set(panel, view)
    }
    updateDetailListView(view, snapshot)
  }
}
