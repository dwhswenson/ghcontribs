import pytest
import json

from ghcontribs.contrib import GitHubContrib, ContribType
from ghcontribs.json_utils import *
from ghcontribs.json_utils import (
    _GitHubContribJSONEncoder, _GitHubContribJSONDecoder
)

@pytest.fixture
def contrib():
    return GitHubContrib(
        owner="openpathsampling",
        repo="openpathsampling",
        number=1000,
        contrib_type=ContribType.ISSUE
    )


def _assert_data(data, contrib):
    assert isinstance(data, dict)
    assert list(data) == ['my_contribs']
    assert data['my_contribs'] == [contrib]


def test_json_serialization_cycle(contrib):
    data = {'my_contribs': [contrib]}
    as_json_str = json.dumps(data, cls=_GitHubContribJSONEncoder)
    reloaded = json.loads(as_json_str, cls=_GitHubContribJSONDecoder)
    _assert_data(reloaded, contrib)


def test_json_file_cycle(tmpdir, contrib):
    data = {'my_contribs': [contrib]}
    filename = tmpdir / "tmp.json"
    assert not filename.exists()
    write_json_file(filename, data)
    assert filename.exists()
    results = load_json_file(filename)
    _assert_data(results, contrib)
