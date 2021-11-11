import urllib.request
import pytest

try:
    urllib.request.urlopen('https://www.google.com')
except:
    HAS_INTERNET = False
else:
    HAS_INTERNET = True

def assert_url(url):
    if not HAS_INTERNET:
        pytest.skip("Internet connection seems faulty")

    resp = urllib.request.urlopen(url)
    assert resp.status == 200
