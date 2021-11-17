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


def test_json_file_cycle_single(tmpdir, contrib):
    # this checks that if we try to save only one contrib outside a list, it
    # gets turned into a list (this behavior may be removed)
    filename = tmpdir / "tmp.json"
    assert not filename.exists()
    write_json_file(filename, contrib)
    assert filename.exists()
    results = load_json_file(filename)
    assert results == [contrib]


def test_assert_json_serialization_error(contrib):
    # this gets coverage of the call to super().default(obj) in the encoder
    bad_list = [contrib, object()]
    with pytest.raises(TypeError):
        _ = json.dumps(bad_list, cls=_GitHubContribJSONEncoder)
