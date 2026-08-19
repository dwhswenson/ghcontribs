import json
import string
import textwrap
from datetime import datetime

from .new_contribs import Comment
from .query import GH_API_ENDPOINT, query as execute_query

REPO_FRAG = """
fragment REPO_INFO on Repository {
  owner {
    login
  }
  name
}
"""

ISSUE_FRAG = """
fragment ISSUE_INFO on Issue {
  number
  title
  createdAt
  url
  repository {
    ...REPO_INFO
  }
}
"""

PR_FRAG = """
fragment PR_INFO on PullRequest {
  number
  title
  createdAt
  url
  merged
  repository {
    ...REPO_INFO
  }
  closingIssuesReferences(first: 100) {
    edges {
      node {
        ...ISSUE_INFO
      }
    }
  }
}
"""

REVIEW_FRAG = """
fragment REVIEW_INFO on PullRequestReview {
  url
  createdAt
  pullRequest {
    ...PR_INFO
  }
}
"""

_CONTRIBUTIONS_TEMPLATE = string.Template("""
$CONTRIBUTION_TYPE(first: $$NUM) {
  edges {
    node {
      $NODE_TYPE {
        ...$INFO_TYPE
      }
    }
  }
}
"""
)

COMMENT_TEMPLATE = """
issueComments(first: $COMMENT_NUM, after: $COMMENT_AFTER) {
  pageInfo {
    hasNextPage
    endCursor
  }
  edges {
    node {
      createdAt
      url
      issue {
        ...ISSUE_INFO
      }
      pullRequest {
        ...PR_INFO
      }
    }
  }
}
"""[1:-1]

ISSUE_CONTRIBUTIONS = _CONTRIBUTIONS_TEMPLATE.substitute(
    CONTRIBUTION_TYPE="issueContributions",
    NODE_TYPE='issue',
    INFO_TYPE="ISSUE_INFO",
)

PR_CONTRIBUTIONS = _CONTRIBUTIONS_TEMPLATE.substitute(
    CONTRIBUTION_TYPE="pullRequestContributions",
    NODE_TYPE="pullRequest",
    INFO_TYPE="PR_INFO",
)

REVIEW_CONTRIBUTIONS = _CONTRIBUTIONS_TEMPLATE.substitute(
    CONTRIBUTION_TYPE="pullRequestReviewContributions",
    NODE_TYPE="pullRequestReview",
    INFO_TYPE="REVIEW_INFO",
)


def make_query(issues, pull_requests, reviews, comments):
    contribs = ""
    fragments = []

    def add_fragments(*new_fragments):
        for fragment in new_fragments:
            if fragment not in fragments:
                fragments.append(fragment)

    if issues:
        contribs += ISSUE_CONTRIBUTIONS
        add_fragments(REPO_FRAG, ISSUE_FRAG)
    if pull_requests:
        contribs += PR_CONTRIBUTIONS
        add_fragments(REPO_FRAG, ISSUE_FRAG, PR_FRAG)
    if reviews:
        contribs += REVIEW_CONTRIBUTIONS
        add_fragments(REPO_FRAG, ISSUE_FRAG, PR_FRAG, REVIEW_FRAG)

    query = 'query {\n  user(login: "$USER") {\n'
    if contribs:
        contributions = (
            'contributionsCollection(from: "$START", to: "$END") {'
            + textwrap.indent(contribs, " " * 2)
            + "}\n"
        )
        query += textwrap.indent(contributions, " " * 4)

    if comments:
        query += textwrap.indent(COMMENT_TEMPLATE, " " * 4) + "\n"
        add_fragments(REPO_FRAG, ISSUE_FRAG, PR_FRAG)

    query += "  }\n}"
    return string.Template("".join(fragments) + '\n' + query)


def get_comments(
    user,
    start,
    end,
    auth,
    page_size=100,
    api_endpoint=GH_API_ENDPOINT,
):
    """Return all of a user's issue comments created in an inclusive range."""
    for name, value in [('start', start), ('end', end)]:
        if not isinstance(value, datetime):
            raise TypeError(f"{name} must be a datetime")
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError(f"{name} must be timezone-aware")
    if start > end:
        raise ValueError("start must not be after end")
    if not 1 <= page_size <= 100:
        raise ValueError("page_size must be between 1 and 100")

    query_template = make_query(
        issues=False,
        pull_requests=False,
        reviews=False,
        comments=True,
    )
    comments = []
    after = None

    while True:
        query_string = query_template.substitute(
            USER=user,
            COMMENT_NUM=page_size,
            COMMENT_AFTER=json.dumps(after),
        )
        response = execute_query(query_string, auth, api_endpoint)
        response.raise_for_status()
        connection = response.json()['data']['user']['issueComments']

        for edge in connection['edges']:
            comment = Comment.from_query_node(edge['node'])
            if start <= comment.created <= end:
                comments.append(comment)

        page_info = connection['pageInfo']
        if not page_info['hasNextPage']:
            break
        after = page_info['endCursor']
        if after is None:
            raise ValueError("Missing end cursor for the next comment page")

    return tuple(sorted(comments))


# LIMITATIONS:
# * assumes you have created no more that 100 each of issues/PRs/reviews
#   (this one should be relaxed later, so it can replace the current
#   query used to get contribs for tracking total contribs)
# * assumes no PR closes more than 100 issues (this might just be left in
#   place)
