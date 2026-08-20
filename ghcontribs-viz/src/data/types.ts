/** A UTC calendar month serialized as YYYY-MM. */
export type Month = string

export interface ContributionCounts {
  issues: number
  pull_requests: number
  reviews: number
  comments: number
}

/** Contribution categories used by visualization filters and summaries. */
export type ContributionType = keyof ContributionCounts

export interface RepositoryContributions {
  total: ContributionCounts
  by_month: Record<Month, ContributionCounts>
}

export interface RepositorySummary {
  key: string
  name: string
  contributions: RepositoryContributions
}

export interface OwnerSummary {
  owner: string
  repositories: RepositorySummary[]
}

export interface VisualizationIndex {
  schema_version: 1
  user: string
  source: {
    first_month: Month
    last_month: Month
  }
  owners: OwnerSummary[]
}

interface ContributionBase {
  url: string
  created: string
}

export interface Issue extends ContributionBase {
  contrib_type: 'issue'
  owner: string
  repo: string
  number: number
  title: string
}

export interface PullRequest extends ContributionBase {
  contrib_type: 'pullRequest'
  owner: string
  repo: string
  number: number
  title: string
  merged: boolean
  closes: Issue[]
}

export interface PullRequestReview extends ContributionBase {
  contrib_type: 'pullRequestReview'
  pr: PullRequest
}

export interface IssueComment extends ContributionBase {
  contrib_type: 'issueComment'
  issue_or_pr: Issue | PullRequest
}

export type Contribution =
  | Issue
  | PullRequest
  | PullRequestReview
  | IssueComment

export type SourceContributionType = Contribution['contrib_type']

export interface RepositoryDetails {
  schema_version: 1
  key: string
  owner: string
  name: string
  contributions: Contribution[]
}
