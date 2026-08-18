import dataclasses
from datetime import datetime, timedelta, timezone

import pytest

from ghcontribs.new_contribs import (
    Comment,
    Contribution,
    Issue,
    PullRequest,
    Review,
)
from ghcontribs.contribs_query import make_query


UTC = timezone.utc


def make_issue(created=None, url="https://github.com/org/repo/issues/1"):
    return Issue(
        created=created or datetime(2024, 1, 1, tzinfo=UTC),
        url=url,
        owner="org",
        repo="repo",
        number=1,
        title="An issue",
    )


def make_pr(created=None, url="https://github.com/org/repo/pull/2", closes=()):
    return PullRequest(
        created=created or datetime(2024, 1, 2, tzinfo=UTC),
        url=url,
        owner="org",
        repo="repo",
        number=2,
        title="A pull request",
        merged=True,
        closes=closes,
    )


def test_contributions_require_datetime():
    with pytest.raises(TypeError, match="created must be a datetime"):
        make_issue(created="2024-01-01T00:00:00Z")


def test_contributions_require_timezone_aware_datetime():
    with pytest.raises(ValueError, match="created must be timezone-aware"):
        make_issue(created=datetime(2024, 1, 1))


def test_contributions_preserve_timezone_offset():
    eastern = timezone(timedelta(hours=-5))
    created = datetime(2024, 1, 1, tzinfo=eastern)

    assert make_issue(created=created).created is created


def test_pull_request_canonicalizes_closes_to_tuple():
    issue = make_issue()
    closes = [issue]

    pr = make_pr(closes=closes)
    closes.append(make_issue(url="https://github.com/org/repo/issues/3"))

    assert pr.closes == (issue,)
    assert isinstance(pr.closes, tuple)


def test_contributions_are_immutable():
    issue = make_issue()

    with pytest.raises(dataclasses.FrozenInstanceError):
        issue.title = "Changed"


def test_mixed_contributions_sort_chronologically():
    issue = make_issue(created=datetime(2024, 1, 4, tzinfo=UTC))
    pr = make_pr(created=datetime(2024, 1, 1, tzinfo=UTC))
    review = Review(
        created=datetime(2024, 1, 2, tzinfo=UTC),
        url=f"{pr.url}#pullrequestreview-1",
        pr=pr,
    )
    comment = Comment(
        created=datetime(2024, 1, 3, tzinfo=UTC),
        url=f"{issue.url}#issuecomment-1",
        issue_or_pr=issue,
    )

    assert sorted([issue, comment, pr, review]) == [pr, review, comment, issue]


def test_ordering_uses_url_then_type_for_ties():
    created = datetime(2024, 1, 1, tzinfo=UTC)
    later_url = make_issue(created=created, url="https://example.com/z")
    issue = make_issue(created=created, url="https://example.com/a")
    pr = make_pr(created=created, url="https://example.com/a")

    assert sorted([later_url, pr, issue]) == [issue, pr, later_url]
    assert issue != pr


def test_ordering_unrelated_objects_is_not_supported():
    issue = make_issue()

    assert issue.__lt__(object()) is NotImplemented
    with pytest.raises(TypeError):
        issue < object()


@pytest.fixture
def contribution_examples():
    issue = make_issue()
    pr = make_pr(closes=(issue,))
    review = Review(
        created=datetime(2024, 1, 3, tzinfo=UTC),
        url=f"{pr.url}#pullrequestreview-1",
        pr=pr,
    )
    comment = Comment(
        created=datetime(2024, 1, 4, tzinfo=UTC),
        url=f"{pr.url}#issuecomment-1",
        issue_or_pr=pr,
    )
    return issue, pr, review, comment


def test_all_contribution_types_round_trip(contribution_examples):
    for contribution in contribution_examples:
        serialized = contribution.to_dict()
        reloaded = Contribution.from_dict(serialized)

        assert reloaded == contribution
        assert type(reloaded) is type(contribution)


def test_serialization_includes_nested_subtype_data(contribution_examples):
    _, pr, review, comment = contribution_examples

    assert pr.to_dict()['closes'][0]['title'] == "An issue"
    assert review.to_dict()['pr']['merged'] is True
    assert comment.to_dict()['issue_or_pr']['contrib_type'] == "pullRequest"
    assert 'body' not in comment.to_dict()


@pytest.mark.parametrize(
    'created,expected',
    [
        ('2024-01-01T12:34:56Z', datetime(2024, 1, 1, 12, 34, 56, tzinfo=UTC)),
        (
            '2024-01-01T12:34:56.123456+00:00',
            datetime(2024, 1, 1, 12, 34, 56, 123456, tzinfo=UTC),
        ),
        (
            '2024-01-01T12:34:56+05:30',
            datetime(
                2024, 1, 1, 12, 34, 56,
                tzinfo=timezone(timedelta(hours=5, minutes=30)),
            ),
        ),
    ],
)
def test_deserialization_accepts_iso_8601_timestamps(created, expected):
    serialized = make_issue().to_dict()
    serialized['created'] = created

    assert Issue.from_dict(serialized).created == expected


def test_generic_deserialization_rejects_unknown_type():
    serialized = make_issue().to_dict()
    serialized['contrib_type'] = 'unknown'

    with pytest.raises(ValueError, match="Unknown contribution type"):
        Contribution.from_dict(serialized)


def test_concrete_deserialization_rejects_mismatched_type():
    with pytest.raises(ValueError, match="Cannot deserialize"):
        Issue.from_dict(make_pr().to_dict())


def test_deserialization_preserves_missing_field_errors():
    serialized = make_issue().to_dict()
    del serialized['title']

    with pytest.raises(KeyError, match="title"):
        Contribution.from_dict(serialized)


def test_deserialization_rejects_non_issue_comment_target():
    pr = make_pr()
    serialized = Comment(
        created=datetime(2024, 1, 3, tzinfo=UTC),
        url=f"{pr.url}#issuecomment-1",
        issue_or_pr=pr,
    ).to_dict()
    serialized['issue_or_pr'] = Review(
        created=datetime(2024, 1, 2, tzinfo=UTC),
        url=f"{pr.url}#pullrequestreview-1",
        pr=pr,
    ).to_dict()

    with pytest.raises(ValueError, match="target must be an issue"):
        Comment.from_dict(serialized)


@pytest.fixture
def issue_query_node():
    return {
        'createdAt': '2024-01-01T12:00:00Z',
        'url': 'https://github.com/org/repo/issues/1',
        'repository': {
            'owner': {'login': 'org'},
            'name': 'repo',
        },
        'number': 1,
        'title': 'An issue',
    }


@pytest.fixture
def pr_query_node(issue_query_node):
    return {
        'createdAt': '2024-01-02T12:00:00Z',
        'url': 'https://github.com/org/repo/pull/2',
        'repository': {
            'owner': {'login': 'org'},
            'name': 'repo',
        },
        'number': 2,
        'title': 'A pull request',
        'merged': True,
        'closingIssuesReferences': {
            'edges': [{'node': issue_query_node}],
        },
    }


def test_issue_from_query_node(issue_query_node):
    issue = Issue.from_query_node(issue_query_node)

    assert issue == make_issue(created=datetime(2024, 1, 1, 12, tzinfo=UTC))


def test_pull_request_from_query_node(pr_query_node):
    pr = PullRequest.from_query_node(pr_query_node)

    assert pr.created == datetime(2024, 1, 2, 12, tzinfo=UTC)
    assert pr.url == 'https://github.com/org/repo/pull/2'
    assert pr.merged is True
    assert pr.closes == (make_issue(
        created=datetime(2024, 1, 1, 12, tzinfo=UTC),
    ),)
    assert isinstance(pr.closes, tuple)


def test_review_from_query_node(pr_query_node):
    node = {
        'createdAt': '2024-01-03T12:00:00Z',
        'url': f"{pr_query_node['url']}#pullrequestreview-1",
        'pullRequest': pr_query_node,
    }

    review = Review.from_query_node(node)

    assert review.created == datetime(2024, 1, 3, 12, tzinfo=UTC)
    assert review.pr == PullRequest.from_query_node(pr_query_node)
    assert review.owner == 'org'
    assert review.repo == 'repo'


def test_issue_comment_from_query_node(issue_query_node):
    node = {
        'createdAt': '2024-01-04T12:00:00Z',
        'url': f"{issue_query_node['url']}#issuecomment-1",
        'issue': issue_query_node,
        'pullRequest': None,
    }

    comment = Comment.from_query_node(node)

    assert type(comment.issue_or_pr) is Issue
    assert comment.issue_or_pr == Issue.from_query_node(issue_query_node)
    assert comment.url.endswith('#issuecomment-1')


def test_pull_request_comment_from_query_node(
    issue_query_node,
    pr_query_node,
):
    node = {
        'createdAt': '2024-01-04T12:00:00Z',
        'url': f"{pr_query_node['url']}#issuecomment-1",
        'issue': issue_query_node,
        'pullRequest': pr_query_node,
    }

    comment = Comment.from_query_node(node)

    assert type(comment.issue_or_pr) is PullRequest
    assert comment.issue_or_pr == PullRequest.from_query_node(pr_query_node)
    assert comment.url.endswith('#issuecomment-1')


def test_comment_query_requests_full_pull_request_data():
    query = make_query(
        issues=False,
        pull_requests=False,
        reviews=False,
        comments=True,
    ).template

    assert 'issueComments(last: 100)' in query
    assert 'pullRequest {\n            ...PR_INFO\n          }' in query
    assert 'fragment PR_INFO on PullRequest' in query
    assert 'closingIssuesReferences(first: 100)' in query
    assert 'body' not in query


def test_query_node_missing_required_data_raises_key_error(issue_query_node):
    del issue_query_node['repository']

    with pytest.raises(KeyError, match='repository'):
        Issue.from_query_node(issue_query_node)
