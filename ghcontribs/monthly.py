import pathlib
import string
import typing
from datetime import datetime, timezone

from ghcontribs import query
from ghcontribs import get_contribs
from ghcontribs import json_utils
from ghcontribs import GitHubContrib


def first_next_month(date: datetime) -> datetime:
    """Return the first of the next month after the input date
    """
    if date.month == 12:
        year = date.year + 1
        month = 1
    else:
        year = date.year
        month = date.month + 1
    return datetime(year, month, 1, tzinfo=timezone.utc)


USER_YEARS_TEMPLATE = string.Template(
"""
{
  user(login: "$USER") {
    contributionsCollection {
      contributionYears
    }
  }
}
"""
)


def get_user_years(user: str, auth: query.AUTH_TYPE,
                   api_endpoint=query.GH_API_ENDPOINT) -> typing.List[int]:
    contribs = query.get_user_contribs(
        user=user, start=None, end=None, auth=auth,
        query_template=USER_YEARS_TEMPLATE, api_endpoint=api_endpoint)
    return contribs['contributionYears']


def get_monthly_contribs(
    user: str,
    year: int,
    month: int,
    auth: query.AUTH_TYPE
) -> typing.List[GitHubContrib]:
    """Get a user's contributions for a given month.

    Parameters
    ----------
    user :
        username to get contributions for
    year :
        year of the contributions
    month :
        month for which to get contributions (January=1, December=12)
    auth :
        authorization information for GitHub API

    Returns
    -------
    :
        list of user's contributions for that time period
    """
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = first_next_month(start)
    contribs = get_contribs.get_contribs(user, start, end, auth)
    return contribs


def _month_year_generator(years: typing.List[int]):
    for year in years:
        for month in range(1, 13):
            yield (month, year)


def write_all_contrib_files(directory: str, user: str,
                            auth: query.AUTH_TYPE):
    """Write monthly contribution files for all user activity.

    Thi writes out JSON files of contributions for the given user, using one
    file per month that the user was active. Filenames will be of the format
    YYYY-MM.json.

    Parameters
    ----------
    directory :
        directory in which to write the files
    user :
        username for the contributions
    auth :
        authorization information for GitHub API
    """
    directory = pathlib.Path(directory)
    user_years = get_user_years(user, auth)
    for month, year in _month_year_generator(user_years):
        contribs = get_monthly_contribs(user, year, month, auth)
        if not contribs:
            continue  # don't write it out if empty!
        filename = directory / f"{year}-{month:02}.json"
        json_utils.write_json_file(filename, contribs)


if __name__ == "__main__":
    # TODO: move some of the authorization stuff elsewhere, since it'll
    # probably be reused
    import os
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('username')
    parser.add_argument(
        '--auth-user', default=None,
        help="Authorization user. If not given, USERNAME is used."
    )
    parser.add_argument('--token', default=None)
    opts = parser.parse_args()
    auth_user = opts.auth_user if opts.auth_user else opts.username
    token = opts.token
    if token is None:
        token = os.env.get("GHCONTRIBS_TOKEN", None)
    if token is None:
        raise RuntimeError("Missing authorization token. Either set the "
                           "environment variable GHCONTRIBS_TOKEN, or use "
                           "the --token argument.")

    auth = (auth_user, token)
    write_all_contrib_files(directory='.', user=opts.username, auth=auth)
