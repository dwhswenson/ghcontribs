import type { Contribution, ContributionType, RepositoryDetails } from '../data/types.ts'
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

const FILTER_TYPES: Record<Contribution['contrib_type'], ContributionType> = {
  issue: 'issues',
  pullRequest: 'pull_requests',
  pullRequestReview: 'reviews',
  issueComment: 'comments',
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

function visibleContributions(
  details: RepositoryDetails,
  snapshot: VisualizationSnapshot,
): Contribution[] {
  const selected = new Set(snapshot.contributionTypes)
  return details.contributions.filter((contribution) => {
    const month = new Date(contribution.created).toISOString().slice(0, 7)
    return selected.has(FILTER_TYPES[contribution.contrib_type]) &&
      month >= snapshot.monthRange.from && month <= snapshot.monthRange.through
  }).sort((left, right) =>
    Date.parse(left.created) - Date.parse(right.created) ||
    left.url.localeCompare(right.url) ||
    left.contrib_type.localeCompare(right.contrib_type),
  )
}

export function renderDetails(
  root: HTMLElement,
  repository: RepositoryViewModel | null,
  state: DetailState | null,
  snapshot: VisualizationSnapshot,
): void {
  const shell = root.querySelector<HTMLElement>('.ghc-visualization')
  if (shell === null) return
  let panel = shell.querySelector<HTMLElement>(':scope > .ghc-details')
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
    shell.append(panel)
  }

  const title = panel.querySelector<HTMLElement>('.ghc-details__title')!
  title.textContent = repository.key
  const summary = panel.querySelector<HTMLElement>('.ghc-details__summary')!
  summary.textContent = `${repository.counts.issues} issues · ${repository.counts.pull_requests} pull requests · ${repository.counts.reviews} reviews · ${repository.counts.comments} comments`
  const status = panel.querySelector<HTMLElement>('.ghc-details__content')!
  status.replaceChildren()
  status.removeAttribute('role')
  panel.setAttribute('aria-busy', String(state.kind === 'loading'))

  if (state.kind === 'loading') {
    status.textContent = 'Loading repository details…'
  } else if (state.kind === 'error') {
    status.setAttribute('role', 'alert')
    const message = document.createElement('p')
    message.textContent = `Repository details could not be loaded: ${state.error instanceof Error ? state.error.message : String(state.error)}`
    const retry = document.createElement('button')
    retry.type = 'button'
    retry.dataset.action = 'retry-details'
    retry.textContent = 'Retry'
    status.append(message, retry)
  } else {
    const contributions = visibleContributions(state.details, snapshot)
    if (contributions.length === 0) {
      status.textContent = 'No contributions match the active filters.'
    } else {
      const list = document.createElement('ol')
      list.className = 'ghc-details__list'
      for (const contribution of contributions) {
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
        list.append(item)
      }
      status.append(list)
    }
  }
}
