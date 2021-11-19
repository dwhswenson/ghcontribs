import string
import typing
from datetime import datetime

AUTH_TYPE = typing.Tuple[str, str]

import requests

GH_API_ENDPOINT = "https://api.github.com/graphql"


class Authorization(typing.NamedTuple):
    """Container for the username and token used for GitHub authentication.

    Attributes
    ----------
    username :
        GitHub username to use in authorization
    token :
        GitHub personal access token to use in authorization
    """
    username: str
    token: str


def query(query: str, auth: AUTH_TYPE, api_endpoint=GH_API_ENDPOINT):
    return requests.post(api_endpoint, json={'query': query}, auth=auth)


def get_user_contribs(user: str,
                      start: datetime,
                      end: datetime,
                      auth: AUTH_TYPE,
                      query_template: string.Template,
                      api_endpoint=GH_API_ENDPOINT):
    if start is not None:
        start = start.isoformat()
    if end is not None:
        end = end.isoformat()
    query_str = query_template.substitute(USER=user,
                                          START=start,
                                          END=end)
    result = query(query_str, auth, api_endpoint)
    return result.json()['data']['user']['contributionsCollection']
