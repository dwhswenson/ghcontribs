"""
Get contributions in one go, not presorted per repo.
"""

# TODO: this doesn't handle pagination yet; need to update for that.
# The approach used here is based on the idea that we'll do one call to load
# all info for a given month, and that each month will then get saved to
# disk.

import string
import typing
from datetime import datetime

from . import query
from .contrib import GitHubContrib, ContribType

# query_template built with https://docs.github.com/en/graphql/overview/explorer
QUERY_TEMPLATE = string.Template(
"""
{
  user(login: "$USER") {
    contributionsCollection(from: "$START", to: "$END") {
      issueContributions(first: 100) {
        nodes {
          issue {
            number
            repository {
              name
              owner {
                login
              }
            }
          }
        }
      }
      pullRequestContributions(first: 100) {
        nodes {
          pullRequest {
            number
            repository {
              name
              owner {
                login
              }
            }
          }
        }
      }
    }
  }
}

"""
)


def _get_contributions_by_type(contribs, contrib_type):
    nodes = contribs[contrib_type.value.contrib_name]['nodes']
    details = [node[contrib_type.value.node_name] for node in nodes]
    contribs = [GitHubContrib(owner=detail['repository']['owner']['login'],
                              repo=detail['repository']['name'],
                              number=detail['number'],
                              contrib_type=contrib_type)
                for detail in details]
    return contribs


def _contribs_from_contrib_collection(contribs):
    return sum([_get_contributions_by_type(contribs, contrib_t)
                for contrib_t in ContribType], [])


def _get_contrib_collection(user: str,
                           start: datetime,
                           end: datetime,
                           auth: typing.Tuple[str, str]):
    # function here just to give docstrings
    return query.get_user_contribs(user=user,
                                   start=start,
                                   end=end,
                                   auth=auth,
                                   query_template=QUERY_TEMPLATE)


def get_contribs(user: str,
                 start: datetime,
                 end: datetime,
                 auth: typing.Tuple[str, str]):
    contrib_collection = _get_contrib_collection(user, start, end, auth)
    contribs = _contribs_from_contrib_collection(contrib_collection)
    return contribs
