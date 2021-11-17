import pytest

import collections
from unittest.mock import Mock, patch
from datetime import datetime, timezone

from ghcontribs.contrib import ContribType
from ghcontribs.get_contribs import *
from .utils import assert_mock_contribs, assert_feb_2016_contribs

# NOTE: we're only testing the get_contribs method here, because that's the
# only that this is truly in the API. The rest is implementation details
# that are very much subject to change. However, since there isn't any
# branching in the current implementation of those implementation details,
# we should still get full coverage.

def test_get_contribs(mock_query):
    # mock out the results of some trivial contributions, and ensure we
    # handle everything correctly on a unit level
    start = datetime(2016, 2, 1, tzinfo=timezone.utc)
    end = datetime(2016, 3, 1, tzinfo=timezone.utc)
    with patch('ghcontribs.query.query', mock_query):
        contribs = get_contribs("dwhswenson", start, end,
                                auth=('foo', 'bar'))

    assert_mock_contribs(contribs)

def test_get_contribs_integration(authorization):
    # when we have an authorization here, we'll do a smoke test for the full
    # integration
    contribs = get_contribs(user="dwhswenson",
                            start=datetime(2016, 2, 1, tzinfo=timezone.utc),
                            end=datetime(2016, 3, 1, tzinfo=timezone.utc),
                            auth=authorization)
    assert_feb_2016_contribs(contribs)

