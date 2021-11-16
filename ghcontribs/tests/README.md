# Tests

The test suite requires `pytest`. Run tests with `py.test` from within the
repository, or `py.test --pyargs ghcontribs` from anywhere. All tests should
pass or skip.

## GitHub Token 

Some tests actually test integration with the live GitHub API. To run these
tests, you need to authorize with GitHub. You will do this with a [personal
access token (PAT)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token).

To use your PAT in the tests, you need to provide your username and the token. You can do this either via environment variables `GHCONTRIBS_USER` and `GHCONTRIBS_TOKEN`, or by creating a file `authorization.py` in the `ghcontribs/tests/` directory, which defines the string variables `USER` and `TOKEN`, i.e.:

```python
# authorization.py
USER = "my_github_username"
TOKEN = "ghp_PUTYOURTOKENHERE"
```

The file `authorization.py` is ignored by git, and should not be shared publicly.
