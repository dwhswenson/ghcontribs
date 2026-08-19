import pathlib
import string
import typing
from datetime import datetime, timedelta, timezone

from . import json_utils, query
from .contrib import Contribution
from .get_contribs import get_contributions


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
) -> tuple[Contribution, ...]:
    """Get a user's contributions for a UTC calendar month."""
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = first_next_month(start) - timedelta(microseconds=1)
    return get_contributions(user, start, end, auth)


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
    for month, year in _month_year_generator(user_years, current=current):
        contribs = get_monthly_contribs(user, year, month, auth)
        filename = directory_path / f'{year}-{month:02}.json'
        json_utils.write_json_file(filename, contribs)
