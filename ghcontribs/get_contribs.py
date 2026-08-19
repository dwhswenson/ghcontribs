import json
import string
import textwrap
from datetime import datetime

from .contrib import Comment, Issue, PullRequest, Review
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
  submittedAt
  pullRequest {
    ...PR_INFO
  }
}
"""

_CONTRIBUTIONS_TEMPLATE = string.Template("""
$CONTRIBUTION_TYPE(first: $$NUM, after: $$$AFTER_NAME) {
  pageInfo {
    hasNextPage
    endCursor
  }
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
    AFTER_NAME="ISSUE_AFTER",
    NODE_TYPE='issue',
    INFO_TYPE="ISSUE_INFO",
)

PR_CONTRIBUTIONS = _CONTRIBUTIONS_TEMPLATE.substitute(
    CONTRIBUTION_TYPE="pullRequestContributions",
    AFTER_NAME="PULL_REQUEST_AFTER",
    NODE_TYPE="pullRequest",
    INFO_TYPE="PR_INFO",
)

REVIEW_CONTRIBUTIONS = _CONTRIBUTIONS_TEMPLATE.substitute(
    CONTRIBUTION_TYPE="pullRequestReviewContributions",
    AFTER_NAME="REVIEW_AFTER",
    NODE_TYPE="pullRequestReview",
    INFO_TYPE="REVIEW_INFO",
)


_PAGE_SPECS = {
    'issues': ('issueContributions', 'issue', Issue, 'ISSUE_AFTER'),
    'pull_requests': (
        'pullRequestContributions',
        'pullRequest',
        PullRequest,
        'PULL_REQUEST_AFTER',
    ),
    'reviews': (
        'pullRequestReviewContributions',
        'pullRequestReview',
        Review,
        'REVIEW_AFTER',
    ),
    'comments': ('issueComments', None, Comment, 'COMMENT_AFTER'),
}


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


def get_contributions(
    user,
    start,
    end,
    auth,
    issues=True,
    pull_requests=True,
    reviews=True,
    comments=True,
    page_size=100,
    api_endpoint=GH_API_ENDPOINT,
):
    """Return selected contribution types from an inclusive date range."""
    for name, value in [('start', start), ('end', end)]:
        if not isinstance(value, datetime):
            raise TypeError(f"{name} must be a datetime")
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError(f"{name} must be timezone-aware")
    if start > end:
        raise ValueError("start must not be after end")
    if not 1 <= page_size <= 100:
        raise ValueError("page_size must be between 1 and 100")

    selected = {
        'issues': issues,
        'pull_requests': pull_requests,
        'reviews': reviews,
        'comments': comments,
    }
    active = {name for name, enabled in selected.items() if enabled}
    after = {name: None for name in active}
    contributions = []

    while active:
        query_template = make_query(**{
            name: name in active
            for name in selected
        })
        substitutions = {
            'USER': user,
            'START': start.isoformat(),
            'END': end.isoformat(),
            'NUM': page_size,
            'COMMENT_NUM': page_size,
        }
        substitutions.update({
            cursor_name: json.dumps(after.get(name))
            for name, (_, _, _, cursor_name) in _PAGE_SPECS.items()
        })
        query_string = query_template.substitute(
            **substitutions
        )
        response = execute_query(query_string, auth, api_endpoint)
        response.raise_for_status()
        user_data = response.json()['data']['user']

        for name in tuple(active):
            connection_name, node_name, contribution_cls, _ = _PAGE_SPECS[name]
            if name == 'comments':
                connection = user_data[connection_name]
            else:
                connection = user_data['contributionsCollection'][
                    connection_name
                ]

            for edge in connection['edges']:
                node = edge['node']
                if node_name is not None:
                    node = node[node_name]
                contribution = contribution_cls.from_query_node(node)
                if name != 'comments' or start <= contribution.created <= end:
                    contributions.append(contribution)

            page_info = connection['pageInfo']
            if not page_info['hasNextPage']:
                active.remove(name)
                continue

            next_cursor = page_info['endCursor']
            if next_cursor is None or next_cursor == after[name]:
                raise ValueError(f"Missing new end cursor for {name} page")
            after[name] = next_cursor

    return tuple(sorted(contributions))


def get_comments(
    user,
    start,
    end,
    auth,
    page_size=100,
    api_endpoint=GH_API_ENDPOINT,
):
    """Return all of a user's issue comments created in an inclusive range."""
    return get_contributions(
        user=user,
        start=start,
        end=end,
        auth=auth,
        issues=False,
        pull_requests=False,
        reviews=False,
        comments=True,
        page_size=page_size,
        api_endpoint=api_endpoint,
    )


# LIMITATIONS:
# * assumes no PR closes more than 100 issues (this might just be left in
#   place)
