import pytest
import os

@pytest.fixture
def authorization():
    try:
        from .authorization import TOKEN, USER
    except ImportError:
        TOKEN = None
        USER = None
    token = os.environ.get("GHCONTRIBS_TOKEN", TOKEN)
    user = os.environ.get("GHCONTRIBS_USER", USER)
    if token is None or user is None:  # -no-cov-
        pytest.skip("Missing authorization to run this test")
    return user, token

