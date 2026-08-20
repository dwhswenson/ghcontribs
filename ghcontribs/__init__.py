import importlib

from .contrib import Comment, Contribution, Issue, PullRequest, Review
from .get_contribs import get_comments, get_contributions
from .json_utils import write_json_file, load_json_file


_MONTHLY_EXPORTS = {'get_monthly_contribs', 'write_all_contrib_files'}


def __getattr__(name):
    if name in _MONTHLY_EXPORTS:
        monthly = importlib.import_module('.monthly', __name__)
        value = getattr(monthly, name)
        globals()[name] = value
        return value
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__():
    return sorted(set(globals()) | _MONTHLY_EXPORTS)
