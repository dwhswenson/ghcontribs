import type {
  Issue,
  IssueComment,
  PullRequest,
  PullRequestReview,
  RepositoryDetails,
  VisualizationIndex,
} from '../src/data/types.ts'

export const issue: Issue = {
  url: 'https://github.com/ExampleOrg/example/issues/1',
  created: '2024-01-01T12:00:00+00:00',
  contrib_type: 'issue',
  owner: 'ExampleOrg',
  repo: 'example',
  number: 1,
  title: 'An issue',
}

export const pullRequest: PullRequest = {
  url: 'https://github.com/ExampleOrg/example/pull/2',
  created: '2024-01-02T12:00:00+00:00',
  contrib_type: 'pullRequest',
  owner: 'ExampleOrg',
  repo: 'example',
  number: 2,
  title: 'A pull request',
  merged: true,
  closes: [issue],
}

export const review: PullRequestReview = {
  url: 'https://github.com/ExampleOrg/example/pull/2#pullrequestreview-1',
  created: '2024-01-03T12:00:00+00:00',
  contrib_type: 'pullRequestReview',
  pr: pullRequest,
}

export const comment: IssueComment = {
  url: 'https://github.com/ExampleOrg/example/issues/1#issuecomment-1',
  created: '2024-01-04T12:00:00+00:00',
  contrib_type: 'issueComment',
  issue_or_pr: issue,
}

export const validIndex: VisualizationIndex = {
  schema_version: 1,
  user: 'octocat',
  source: {
    first_month: '2024-01',
    last_month: '2024-02',
  },
  owners: [
    {
      owner: 'ExampleOrg',
      repositories: [
        {
          key: 'ExampleOrg/example',
          name: 'example',
          contributions: {
            total: {
              issues: 1,
              pull_requests: 1,
              reviews: 1,
              comments: 1,
            },
            by_month: {
              '2024-01': {
                issues: 1,
                pull_requests: 1,
                reviews: 1,
                comments: 1,
              },
            },
          },
        },
      ],
    },
  ],
}

export const validDetails: RepositoryDetails = {
  schema_version: 1,
  key: 'ExampleOrg/example',
  owner: 'ExampleOrg',
  name: 'example',
  contributions: [issue, pullRequest, review, comment],
}
