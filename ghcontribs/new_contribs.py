import dataclasses
from datetime import datetime

from typing import List, ClassVar, Union


def parse_date(date):
    return datetime.strptime(date, "%Y-%m-%dT%H:%M:%S%z")


@dataclasses.dataclass(frozen=True, order=True)
class Contribution:
    created : datetime
    url : str
    contrib_type : ClassVar[str] = ""

    @classmethod
    def _query_node_to_input_dict(cls, node):
        return {
            'url': node['url'],
            'created': parse_date(node['createdAt']),
        }

    @classmethod
    def _prep_from_dict(cls, dct):
        if dct['contrib_type'] != cls.contrib_type:
            raise RuntimeError()

        return {
            'url': dct['url'],
            'created': parse_date(dct['createdAt']),
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
        input_dct = cls._prep_from_dict(dct)
        return cls(**dct)


@dataclasses.dataclass(frozen=True)
class Issue(Contribution):
    owner : str
    repo : str
    number : int
    title : str
    contrib_type : ClassVar[str] = "issue"

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
    def _prep_from_dict(cls, dct):
        dct = dct.copy()
        dct.update(super()._prep_from_dict(dct))
        return dct

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
    merged : bool
    closes : List[Issue]
    contrib_type : ClassVar[str] = "pullRequest"

    def to_dict(self):
        dct = super().to_dict()
        dct.update({
            'merged': self.merged,
            'closes': [iss.to_dict() for iss in self.closes],
        })
        return dct

    @classmethod
    def _prep_from_dict(cls, dct):
        params = super()._prep_from_dict(dct)
        params['merged'] = dct['merged']
        params['closes'] = [Issue.from_dict(iss) for iss in dct['closes']]
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
    pr : PullRequest
    contrib_type : ClassVar[str] = "pullRequestReview"

    @property
    def owner(self):
        return self.pr.owner

    @property
    def repo(self):
        return self.pr.repo

    @classmethod
    def _query_node_to_input_dict(cls, node):
        dct = super()._query_node_to_input_dict(node)
        dct['pr'] = PullRequest.from_query_node(node['pullRequest'])
        return dct


@dataclasses.dataclass(frozen=True)
class Comment(Contribution):
    issue_or_pr : Union[Issue, PullRequest]
    body : str
    contrib_type : ClassVar[str] = "issueComment"

    @property
    def owner(self):
        return self.issue_or_pr.owner

    @property
    def repo(self):
        return self.issue_or_pr.repo

    @classmethod
    def _query_node_to_input_dict(cls, node):
        dct = super()._query_node_to_input_dict(node)
        dct['issue_or_pr'] = Issue.from_query_node(node['issue'])
        dct['body'] = node['body']
        return dct
