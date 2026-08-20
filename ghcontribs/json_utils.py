import json
import typing

from .contrib import Contribution


FILELIKE_OR_FILENAME = typing.Union[typing.TextIO, str]
_CONTRIBUTION_KEYS = {'contrib_type', 'created', 'url'}


class _ContributionJSONEncoder(json.JSONEncoder):
    """Encode rich contribution objects as JSON dictionaries."""

    def default(self, obj):
        if isinstance(obj, Contribution):
            return obj.to_dict()
        return super().default(obj)


def _decode_contributions(value):
    """Recursively reconstruct contributions in a decoded JSON value."""
    if isinstance(value, list):
        return [_decode_contributions(item) for item in value]
    if isinstance(value, dict):
        if _CONTRIBUTION_KEYS <= value.keys():
            return Contribution.from_dict(value)
        return {
            key: _decode_contributions(item)
            for key, item in value.items()
        }
    return value


class _ContributionJSONDecoder(json.JSONDecoder):
    """Decode rich contribution dictionaries without losing nested data."""

    def decode(self, string, **kwargs):
        value = super().decode(string, **kwargs)
        return _decode_contributions(value)


def _write_json(filelike, contrib_list):
    json_str = json.dumps(contrib_list, cls=_ContributionJSONEncoder)
    filelike.write(json_str)


def write_json_file(filename: str, contrib_list):
    """Output contributions to a JSON file."""
    if isinstance(contrib_list, Contribution):
        contrib_list = [contrib_list]

    with open(filename, mode='w', encoding='utf-8') as file_handle:
        _write_json(file_handle, contrib_list)


def load_json_file(filename: str) -> typing.Any:
    """Load a JSON file, reconstructing any rich contributions it contains."""
    with open(filename, mode='r', encoding='utf-8') as file_handle:
        return json.load(file_handle, cls=_ContributionJSONDecoder)
