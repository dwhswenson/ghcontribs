"""
Data structures used to represent GitHub contributions in this repository.

Much of the in this repo involves are getting things into these data
structures or using objects in these data structures to output something
interesting.
"""

import dataclasses
import enum
import typing

class ContribTypeInfo(typing.NamedTuple):
    """Used as the value for the ContribType enum.

    Parameters
    ----------
    name :
        name of this contribution type; note related to the GitHub API
    url_name :
        addition to URL for this contribution type ('pull' or 'issue')
    node_name :
        label for this kind of node in the JSON output
    contrib_name :
    by_repo_name :
        label for this type of contribution when loading contributions by
        repository
    """
    name: str
    url_name: str
    node_name: str
    contrib_name: str
    by_repo_name: str


@enum.unique
class ContribType(enum.Enum):
    """Enumeration for GitHub contribution types.

    Note that the enumeration values are mapped to a
    :class:`.ContribTypeInfo`, which contains further information about that
    type.

    .. note::

        This class contains methods ``serialize`` and ``deserialize``, which
        for some reason aren't currently being found by Sphinx (to generate
        online documentation).
    """
    PULL = ContribTypeInfo(
        name="pull",
        url_name="pull",
        node_name="pullRequest",
        contrib_name="pullRequestContributions",
        by_repo_name="pullRequestContributionsByRepository",
    )
    """value for pull request contribution"""

    ISSUE = ContribTypeInfo(
        name="issue",
        url_name="issues",
        node_name="issue",
        contrib_name="issueContributions",
        by_repo_name="issueContributionsByRepository",
    )
    """value for issue contribution"""

    def __repr__(self):
        return f"<{self.__class__.__name__}.{self.name}>"

    def serialize(self) -> str:
        """Serialization of this type for JSON.

        Returns
        -------
        str :
            string representation of this contribution type ('pull' or
            'issue')
        """
        return self.name

    @classmethod
    def deserialize(cls, name: str):
        """Construct from JSON-serialized string

        Parameters
        ----------
        name : str
            string representation of the desired contribution type ('pull'
            or 'issue')
        """
        return cls[name]


@dataclasses.dataclass
class GitHubContrib:
    """Representation of a single contribution on GitHub.

    Parameters
    ----------
    owner :
        the organization or username owner of the repository
    repo :
        the name of the repository
    number :
        the issue or PR number associated with the contribution
    contrib_type : :class:`.ContribType`
        the type of contribution
    """
    owner: str
    repo: str
    number: int
    contrib_type: ContribType

    @property
    def url(self) -> str:
        """URL for this contribution"""
        return (f"https://github.com/{self.owner}/{self.repo}/"
                f"{self.contrib_type.value.url_name}/{self.number}")

    @property
    def github_shortname(self) -> str:
        """string used in GitHub to refer to this contributions"""
        return f"{self.owner}/{self.repo}#{self.number}"

    def to_dict(self):
        """Convert this to a dict suitable for JSON serialization

        Returns
        -------
        dict :
            dict representation of this object
        """
        dct = dataclasses.asdict(self)
        dct['contrib_type'] = dct['contrib_type'].serialize()
        return dct

    @classmethod
    def from_dict(cls, dct):
        """Create instance from a dict representation.

        Parameters
        ----------
        dct : dict
            dict representation of this object; must match output of
            :meth:`.to_dict`.

        Returns
        -------
        :class:`.GitHubContrib` :
            constructed object
        """
        dct = dict(dct)  # make a copy before modification
        dct['contrib_type'] = ContribType.deserialize(dct['contrib_type'])
        return cls(**dct)
