import argparse
import os
import pathlib
import string
import typing
from datetime import datetime, timedelta, timezone

from . import json_utils, query
from .contrib import Contribution
from .get_contribs import get_comments, get_contributions


def first_next_month(date: datetime) -> datetime:
    """Return the first of the next month after the input date."""
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


def get_user_years(
    user: str,
    auth: query.AUTH_TYPE,
    api_endpoint=query.GH_API_ENDPOINT,
) -> list[int]:
    contribs = query.get_user_contribs(
        user=user,
        start=None,
        end=None,
        auth=auth,
        query_template=USER_YEARS_TEMPLATE,
        api_endpoint=api_endpoint,
    )
    return contribs['contributionYears']


def get_monthly_contribs(
    user: str,
    year: int,
    month: int,
    auth: query.AUTH_TYPE,
    *,
    comments: bool = True,
) -> tuple[Contribution, ...]:
    """Get a user's contributions for a UTC calendar month."""
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = first_next_month(start) - timedelta(microseconds=1)
    return get_contributions(user, start, end, auth, comments=comments)


def _current_utc_datetime() -> datetime:
    return datetime.now(timezone.utc)


def _month_year_generator(
    years: typing.Iterable[int],
    current: datetime | None = None,
):
    current = current or _current_utc_datetime()
    for year in sorted(set(years)):
        final_month = 12 if year < current.year else current.month
        if year > current.year:
            continue
        for month in range(1, final_month + 1):
            yield month, year


def write_all_contrib_files(
    directory: str,
    user: str,
    auth: query.AUTH_TYPE,
):
    """Write one rich-contribution JSON file per eligible month."""
    directory_path = pathlib.Path(directory)
    directory_path.mkdir(parents=True, exist_ok=True)

    user_years = get_user_years(user, auth)
    current = _current_utc_datetime()
    months = list(_month_year_generator(user_years, current=current))
    if not months:
        return

    first_month, first_year = months[0]
    last_month, last_year = months[-1]
    comment_start = datetime(
        first_year,
        first_month,
        1,
        tzinfo=timezone.utc,
    )
    comment_end = first_next_month(datetime(
        last_year,
        last_month,
        1,
        tzinfo=timezone.utc,
    )) - timedelta(microseconds=1)
    comments = get_comments(user, comment_start, comment_end, auth)
    comments_by_month: dict[tuple[int, int], list[Contribution]] = {}
    for comment in comments:
        created_utc = comment.created.astimezone(timezone.utc)
        comments_by_month.setdefault(
            (created_utc.month, created_utc.year),
            [],
        ).append(comment)

    for month, year in months:
        monthly = get_monthly_contribs(
            user,
            year,
            month,
            auth,
            comments=False,
        )
        contribs = tuple(sorted(
            (*monthly, *comments_by_month.get((month, year), ()))
        ))
        filename = directory_path / f'{year}-{month:02}.json'
        json_utils.write_json_file(filename, contribs)


def main(args=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('username')
    parser.add_argument(
        '--auth-user',
        default=None,
        help='Authorization user. If not given, USERNAME is used.',
    )
    parser.add_argument('--token', default=None)
    parser.add_argument(
        '--output-directory',
        default='.',
        help=(
            'Directory for monthly YYYY-MM.json files '
            '(default: current directory).'
        ),
    )
    opts = parser.parse_args(args)

    auth_user = opts.auth_user or opts.username
    token = opts.token or os.environ.get('GHCONTRIBS_TOKEN')
    if token is None:
        parser.error(
            'missing authorization token: use --token or set GHCONTRIBS_TOKEN'
        )

    write_all_contrib_files(
        directory=opts.output_directory,
        user=opts.username,
        auth=(auth_user, token),
    )


if __name__ == '__main__':
    main()
