import urllib.request
import pytest

try:
    urllib.request.urlopen('https://www.google.com')
except:  # -no-cov-
    HAS_INTERNET = False
else:
    HAS_INTERNET = True

def assert_url(url):
    if not HAS_INTERNET:  # -no-cov-
        pytest.skip("Internet connection seems faulty")

    resp = urllib.request.urlopen(url)
    assert resp.status == 200
