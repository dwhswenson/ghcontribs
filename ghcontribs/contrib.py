"""
Data structures used to represent GitHub contributions in this repository.

Much of the in this repo involves are getting things into these data
structures or using objects in these data structures to output something
interesting.
"""

import dataclasses
import enum
import typing

class _ContribTypeInfo(typing.NamedTuple):
    """Used as the value for the ContribType enum.

    Parameters
    ----------
    name
        name of this contribution type; not related to the GitHub API
    url_name
        addition to URL find this contribution ('pull' or 'issue')
    node_name
        label for this kind of node in the JSON output
    contrib_name
    by_repo_name
        label for loading this group of contributions when loading
        contributions by repository
    """
    name: str
    url_name: str
    node_name: str
    contrib_name: str
    by_repo_name: str


@enum.unique
class ContribType(enum.Enum):
    PULL = _ContribTypeInfo(
        name="pull",
        url_name="pulls",
        node_name="pullRequest",
        contrib_name="pullRequestContributions",
        by_repo_name="pullRequestContributionsByRepository",
    )
    ISSUE = _ContribTypeInfo(
        name="issue",
        url_name="issues",
        node_name="issue",
        contrib_name="issueContributions",
        by_repo_name="issueContributionsByRepository",
    )

    def __repr__(self):
        return f"<{self.__class__.__name__}.{self.name}>"

    def serialize(self) -> str:
        return self.name

    @classmethod
    def deserialize(cls, name: str):
        return cls[name]


@dataclasses.dataclass
class GitHubContrib:
    owner: str
    repo: str
    number: int
    contrib_type: ContribType

    @property
    def url(self) -> str:
        return (f"https://github.com/{self.owner}/{self.repo}/"
                f"{self.contrib_type.value.url_name}/{self.number}")

    @property
    def github_shortname(self) -> str:
        return f"{self.owner}/{self.repo}#{self.number}"

    def to_dict(self):
        dct = dataclasses.asdict(self)
        dct['contrib_type'] = dct['contrib_type'].serialize()
        return dct

    @classmethod
    def from_dict(cls, dct):
        dct = dict(dct)  # make a copy before modification
        dct['contrib_type'] = ContribType.deserialize(dct['contrib_type'])
        return cls(**dct)

