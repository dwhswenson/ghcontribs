import json
from datetime import datetime, timezone

import pytest

from ghcontribs.contrib import Comment, Issue, PullRequest, Review
from ghcontribs.json_utils import (
    _ContributionJSONDecoder,
    _ContributionJSONEncoder,
    load_json_file,
    write_json_file,
)


UTC = timezone.utc


@pytest.fixture
def contribs():
    issue = Issue(
        created=datetime(2024, 1, 1, tzinfo=UTC),
        url='https://github.com/org/repo/issues/1',
        owner='org',
        repo='repo',
        number=1,
        title='Issue',
    )
    pr = PullRequest(
        created=datetime(2024, 1, 2, tzinfo=UTC),
        url='https://github.com/org/repo/pull/2',
        owner='org',
        repo='repo',
        number=2,
        title='Pull request',
        merged=True,
        closes=(issue,),
    )
    review = Review(
        created=datetime(2024, 1, 3, tzinfo=UTC),
        url=f'{pr.url}#pullrequestreview-3',
        pr=pr,
    )
    comment = Comment(
        created=datetime(2024, 1, 4, tzinfo=UTC),
        url=f'{pr.url}#issuecomment-4',
        issue_or_pr=pr,
    )
    return issue, pr, review, comment


def test_all_contribution_types_round_trip_through_json(contribs):
    encoded = json.dumps(contribs, cls=_ContributionJSONEncoder)
    decoded = json.loads(encoded, cls=_ContributionJSONDecoder)

    assert decoded == list(contribs)
    assert [type(item) for item in decoded] == [type(item) for item in contribs]


def test_nested_container_round_trip(contribs):
    data = {'my_contribs': [contribs[2], contribs[3]]}

    encoded = json.dumps(data, cls=_ContributionJSONEncoder)
    decoded = json.loads(encoded, cls=_ContributionJSONDecoder)

    assert decoded == data


def test_json_file_round_trip(tmp_path, contribs):
    filename = tmp_path / 'contribs.json'

    write_json_file(filename, list(contribs))

    assert load_json_file(filename) == list(contribs)


def test_single_contribution_is_normalized_to_list(tmp_path, contribs):
    filename = tmp_path / 'contrib.json'

    write_json_file(filename, contribs[0])

    assert load_json_file(filename) == [contribs[0]]


def test_unrelated_json_objects_are_unchanged():
    data = {'created': 'today', 'url': 'https://example.com', 'other': [1, 2]}

    encoded = json.dumps(data)

    assert json.loads(encoded, cls=_ContributionJSONDecoder) == data


def test_invalid_contribution_type_is_rejected(contribs):
    serialized = contribs[0].to_dict()
    serialized['contrib_type'] = 'unknown'

    with pytest.raises(ValueError, match='Unknown contribution type'):
        json.loads(json.dumps(serialized), cls=_ContributionJSONDecoder)


def test_non_serializable_values_raise(contribs):
    with pytest.raises(TypeError):
        json.dumps([contribs[0], object()], cls=_ContributionJSONEncoder)
