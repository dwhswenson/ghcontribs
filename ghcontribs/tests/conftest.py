import pytest
import os

@pytest.fixture
def authorization():
    token = os.environ.get("GHCONTRIBS_TOKEN", None)
    user = os.environ.get("GHCONTRIBS_USER", None)
    if token is None or user is None:
        pytest.skip("Missing authorization to run this test")
    return user, token

