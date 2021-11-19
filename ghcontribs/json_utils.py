import json
import typing
from ghcontribs.contrib import GitHubContrib

FILELIKE_OR_FILENAME = typing.Union[typing.TextIO, str]


class _GitHubContribJSONEncoder(json.JSONEncoder):
    """Custom encoder for GitHubContrib objects"""
    def default(self, obj):
        if isinstance(obj, GitHubContrib):
            return obj.to_dict()
        return super().default(obj)


class _GitHubContribJSONDecoder(json.JSONDecoder):
    """Custom decoder for GitHubContrib objects"""
    # __dataclass_fields__ is dirty trick to facilitate upkeep
    GH_CONTRIB_KEYS = set(GitHubContrib.__dataclass_fields__.keys())
    def __init__(self, *args, **kwargs):
        json.JSONDecoder.__init__(self, object_hook=self.object_hook, *args,
                                  **kwargs)

    def object_hook(self, dct):
        if isinstance(dct, dict) and set(dct.keys()) == self.GH_CONTRIB_KEYS:
            return GitHubContrib.from_dict(dct)
        return dct


def _write_json(filelike, contrib_list):
    json_str = json.dumps(contrib_list, cls=_GitHubContribJSONEncoder)
    filelike.write(json_str)


def write_json_file(filename: str, contrib_list):
    # TODO: typing on contrib_list -- maybe don't regularize to list
    """Output the contribution list to a JSON file.

    Parameters
    ----------
    filename :
        the name of the file to write to
    """
    # regularize to list in case client didn't
    if isinstance(contrib_list, GitHubContrib):
        contrib_list = [contrib_list]

    # TODO: support whether filename is filename of filelike
    with open(filename, mode='w') as f:
        _write_json(f, contrib_list)


def load_json_file(filename: str) -> typing.Any:
    """Load a contribution list from a JSON file

    Parameters
    ----------
    filename :
        the name of the JSON file to load

    Returns
    -------
    Any :
        representation of the JSON file
    """
    with open(filename, mode='r') as f:
        contribs = json.loads(f.read(), cls=_GitHubContribJSONDecoder)
    return contribs
