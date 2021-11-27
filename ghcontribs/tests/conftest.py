import pytest
import os
from unittest.mock import Mock

@pytest.fixture
def authorization():
    try:
        from .authorization import TOKEN, USER
    except ImportError:  # -no-cov-
        TOKEN = None
        USER = None
    token = os.environ.get("GHCONTRIBS_TOKEN", TOKEN)
    user = os.environ.get("GHCONTRIBS_USER", USER)
    if token is None or user is None:  # -no-cov-
        pytest.skip("Missing authorization to run this test")
    return user, token

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


@pytest.fixture
def mock_query():
    mock_json = Mock(return_value=_FULL_RESPONSE)
    mock_query = Mock(return_value=Mock(json=mock_json))
    return mock_query
