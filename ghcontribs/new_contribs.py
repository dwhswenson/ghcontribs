import dataclasses
from datetime import datetime
from typing import ClassVar


def parse_date(date):
    return datetime.fromisoformat(date)


@dataclasses.dataclass(frozen=True)
class Contribution:
    created: datetime
    url: str
    contrib_type: ClassVar[str] = ""

    def __post_init__(self):
        if not isinstance(self.created, datetime):
            raise TypeError("created must be a datetime")
        if self.created.tzinfo is None or self.created.utcoffset() is None:
            raise ValueError("created must be timezone-aware")

    def _sort_key(self):
        return (self.created, self.url, self.contrib_type)

    def __lt__(self, other):
        if not isinstance(other, Contribution):
            return NotImplemented
        return self._sort_key() < other._sort_key()

    @classmethod
    def _query_node_to_input_dict(cls, node):
        return {
            'url': node['url'],
            'created': parse_date(node['createdAt']),
        }

    @classmethod
    def _from_dict_params(cls, dct):
        if dct['contrib_type'] != cls.contrib_type:
            raise ValueError(
                f"Cannot deserialize {dct['contrib_type']!r} as "
                f"{cls.contrib_type!r}"
            )

        return {
            'url': dct['url'],
            'created': parse_date(dct['created']),
        }

    @classmethod
    def from_query_node(cls, node):
        dct = cls._query_node_to_input_dict(node)
        return cls(**dct)

    def to_dict(self):
        return {
            'url': self.url,
            'created': self.created.isoformat(),
            'contrib_type': self.contrib_type,
        }

    @classmethod
    def from_dict(cls, dct):
        if cls is Contribution:
            contrib_type = dct['contrib_type']
            try:
                contrib_cls = _CONTRIBUTION_TYPES[contrib_type]
            except KeyError:
                raise ValueError(
                    f"Unknown contribution type: {contrib_type!r}"
                ) from None
            return contrib_cls.from_dict(dct)
        return cls(**cls._from_dict_params(dct))


@dataclasses.dataclass(frozen=True)
class Issue(Contribution):
    owner: str
    repo: str
    number: int
    title: str
    contrib_type: ClassVar[str] = "issue"

    def to_dict(self):
        dct = super().to_dict()
        dct.update({
            'owner': self.owner,
            'repo': self.repo,
            'number': self.number,
            'title': self.title,
        })
        return dct

    @classmethod
    def _from_dict_params(cls, dct):
        params = super()._from_dict_params(dct)
        params.update({
            'owner': dct['owner'],
            'repo': dct['repo'],
            'number': dct['number'],
            'title': dct['title'],
        })
        return params

    @classmethod
    def _query_node_to_input_dict(cls, node):
        dct = super()._query_node_to_input_dict(node)
        dct.update({
            'owner': node['repository']['owner']['login'],
            'repo': node['repository']['name'],
            'number': node['number'],
            'title': node['title'],
        })
        return dct


@dataclasses.dataclass(frozen=True)
class PullRequest(Issue):
    merged: bool
    closes: tuple[Issue, ...]
    contrib_type: ClassVar[str] = "pullRequest"

    def __post_init__(self):
        super().__post_init__()
        object.__setattr__(self, 'closes', tuple(self.closes))

    def to_dict(self):
        dct = super().to_dict()
        dct.update({
            'merged': self.merged,
            'closes': [iss.to_dict() for iss in self.closes],
        })
        return dct

    @classmethod
    def _from_dict_params(cls, dct):
        params = super()._from_dict_params(dct)
        params['merged'] = dct['merged']
        params['closes'] = tuple(
            Issue.from_dict(issue) for issue in dct['closes']
        )
        return params

    @classmethod
    def _query_node_to_input_dict(cls, node):
        dct = super()._query_node_to_input_dict(node)
        dct.update({
            'closes' : [
                Issue.from_query_node(edge['node'])
                for edge in node['closingIssuesReferences']['edges']
            ],
            'merged': node['merged']
        })
        return dct


@dataclasses.dataclass(frozen=True)
class Review(Contribution):
    pr: PullRequest
    contrib_type: ClassVar[str] = "pullRequestReview"

    @property
    def owner(self):
        return self.pr.owner

    @property
    def repo(self):
        return self.pr.repo

    def to_dict(self):
        dct = super().to_dict()
        dct['pr'] = self.pr.to_dict()
        return dct

    @classmethod
    def _from_dict_params(cls, dct):
        params = super()._from_dict_params(dct)
        params['pr'] = PullRequest.from_dict(dct['pr'])
        return params

    @classmethod
    def _query_node_to_input_dict(cls, node):
        dct = super()._query_node_to_input_dict(node)
        dct['pr'] = PullRequest.from_query_node(node['pullRequest'])
        return dct


@dataclasses.dataclass(frozen=True)
class Comment(Contribution):
    issue_or_pr: Issue | PullRequest
    body: str
    contrib_type: ClassVar[str] = "issueComment"

    @property
    def owner(self):
        return self.issue_or_pr.owner

    @property
    def repo(self):
        return self.issue_or_pr.repo

    def to_dict(self):
        dct = super().to_dict()
        dct.update({
            'issue_or_pr': self.issue_or_pr.to_dict(),
            'body': self.body,
        })
        return dct

    @classmethod
    def _from_dict_params(cls, dct):
        params = super()._from_dict_params(dct)
        issue_or_pr = Contribution.from_dict(dct['issue_or_pr'])
        if not isinstance(issue_or_pr, Issue):
            raise ValueError("A comment target must be an issue or pull request")
        params.update({
            'issue_or_pr': issue_or_pr,
            'body': dct['body'],
        })
        return params

    @classmethod
    def _query_node_to_input_dict(cls, node):
        dct = super()._query_node_to_input_dict(node)
        dct['issue_or_pr'] = Issue.from_query_node(node['issue'])
        dct['body'] = node['body']
        return dct


_CONTRIBUTION_TYPES = {
    contrib_cls.contrib_type: contrib_cls
    for contrib_cls in (Issue, PullRequest, Review, Comment)
}
