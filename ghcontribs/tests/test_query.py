import pytest
from unittest.mock import Mock, patch

import string
from datetime import datetime, timezone

from ghcontribs.query import *

QUERY_EXAMPLE = """
{
  user(login: "dwhswenson") {
    contributionsCollection {
      hasActivityInThePast
      hasAnyContributions
    }
  }
}
"""

EXPECTED = {
    "data": {
        "user": {
            "contributionsCollection": {
                "hasActivityInThePast": True,
                "hasAnyContributions": True
            }
        }
    }
}

def test_query(authorization):
    # in this test we actually check the integration with a real request, to
    # ensure the API hasn't changed on us
    res = query(QUERY_EXAMPLE, auth=authorization)
    assert res.ok
    assert res.status_code == 200
    json_results = res.json()
    assert json_results == EXPECTED


def test_get_user_contributions():
    # this mocks out the actualQUERY_EXAMPLE use contribution and gives us
    # something reasonable for the results
    mock_req = Mock(json=Mock(return_value=EXPECTED))
    mock_query = Mock(return_value=mock_req)
    fake_query = ("username=$USER\n" "start=$START\n" "end=$END\n")
    template = string.Template(fake_query)
    auth = ("auth_user", "auth_token")
    with patch('ghcontribs.query.query', mock_query):
        contribs = get_user_contribs(
            user="some_user",
            start=datetime(2021, 1, 1, tzinfo=timezone.utc),
            end=datetime(2021, 1, 2, tzinfo=timezone.utc),
            auth=auth,
            query_template=template
        )
    assert contribs == {'hasActivityInThePast': True,
                        'hasAnyContributions': True}
    expected_query = ('username=some_user\n'
                      'start="2021-01-01T00:00:00Z"\n'
                      'end="2021-01-02T00:00:00Z"\n')
    assert mock_query.called_once_with([
        expected_query, auth, GH_API_ENDPOINT
    ])


def test_get_user_contributions_integration(authorization):
    # this is an integration that checks that the API hasn't changed on us.
    # Purely a smoke test that should error out if this part of the code has
    # changed.
    template = string.Template(QUERY_EXAMPLE)
    contribs = get_user_contribs(user="dwhswenson",
                                 start=datetime(2021, 1, 1,
                                                tzinfo=timezone.utc),
                                 end=datetime(2021, 2, 1,
                                              tzinfo=timezone.utc),
                                 auth=authorization,
                                 query_template=template)
