import urllib.request
import collections
import pytest

from ghcontribs.contrib import ContribType

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


def assert_mock_contribs(contribs):
    """Check that we have the correct contribs from the mock_query fixture
    """
    assert len(contribs) == 2
    for contrib in contribs:
        assert contrib.owner == 'openpathsampling'
        assert contrib.repo == 'openpathsampling'

    contrib_dict = {c.contrib_type: c for c in contribs}
    assert len(contrib_dict) == 2
    assert contrib_dict[ContribType.PULL].number == 1001
    assert contrib_dict[ContribType.ISSUE].number == 1000


def assert_feb_2016_contribs(contribs):
    by_type = collections.defaultdict(list)
    for contrib in contribs:
        by_type[contrib.contrib_type].append(contrib)

    assert len(contribs) == 19
    assert len(by_type[ContribType.PULL]) == 17
    assert len(by_type[ContribType.ISSUE]) == 2
