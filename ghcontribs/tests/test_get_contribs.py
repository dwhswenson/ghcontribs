import pytest

import collections
from unittest.mock import Mock, patch
from datetime import datetime, timezone

from ghcontribs.contrib import ContribType
from ghcontribs.get_contribs import *

_FULL_RESPONSE = {
  "data": {
    "user": {
      "contributionsCollection": {
        "issueContributions": {
          "nodes": [ {
              "issue": {
                "number": 1000,
                "repository": {
                  "name": "openpathsampling",
                  "owner": {
                    "login": "openpathsampling"
                  }
                }
              }
            },
          ]
        },
        "pullRequestContributions": {
          "nodes": [
            {
              "pullRequest": {
                "number": 1001,
                "repository": {
                  "name": "openpathsampling",
                  "owner": {
                    "login": "openpathsampling"
                  }
                }
              }
            },
          ]
        }
      }
    }
  }
}

# NOTE: we're only testing the get_contribs method here, because that's the
# only that this is truly in the API. The rest is implementation details
# that are very much subject to change. However, since there isn't any
# branching in the current implementation of those implementation details,
# we should still get full coverage.

def test_get_contribs():
    # mock out the results of some trivial contributions, and ensure we
    # handle everything correctly on a unit level
    mock_return = Mock(json=Mock(return_value=_FULL_RESPONSE))
    start = datetime(2016, 2, 1, tzinfo=timezone.utc)
    end = datetime(2016, 3, 1, tzinfo=timezone.utc)
    with patch('ghcontribs.query.query', Mock(return_value=mock_return)):
        contribs = get_contribs("dwhswenson", start, end,
                                auth=('foo', 'bar'))
    assert len(contribs) == 2
    for contrib in contribs:
        assert contrib.owner == 'openpathsampling'
        assert contrib.repo == 'openpathsampling'

    contrib_dict = {c.contrib_type: c for c in contribs}
    assert len(contrib_dict) == 2
    assert contrib_dict[ContribType.PULL].number == 1001
    assert contrib_dict[ContribType.ISSUE].number == 1000


def test_get_contribs_integration(authorization):
    # when we have an authorization here, we'll do a smoke test for the full
    # integration
    contribs = get_contribs(user="dwhswenson",
                            start=datetime(2016, 2, 1, tzinfo=timezone.utc),
                            end=datetime(2016, 3, 1, tzinfo=timezone.utc),
                            auth=authorization)
    by_type = collections.defaultdict(list)
    for contrib in contribs:
        by_type[contrib.contrib_type].append(contrib)

    assert len(contribs) == 19
    assert len(by_type[ContribType.PULL]) == 17
    assert len(by_type[ContribType.ISSUE]) == 2
