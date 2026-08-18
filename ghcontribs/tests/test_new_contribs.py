import dataclasses
from datetime import datetime, timedelta, timezone

import pytest

from ghcontribs.new_contribs import Comment, Issue, PullRequest, Review


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
        body="A comment",
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
