import pytest
from datetime import datetime, timezone
from unittest.mock import Mock, patch
import itertools
import pathlib

from ghcontribs.monthly import *
from ghcontribs.monthly import _month_year_generator
from .utils import assert_mock_contribs, assert_feb_2016_contribs

DAVID_IS_DEAD = False


@pytest.fixture
def mock_user_years_query():
    mock_user_contribs = { "data": { "user": { "contributionsCollection": {
        "contributionYears": [ 2021, 2020, 2019, 2018, 2017, 2016, 2015,
                              2014, 2013 ]
    } } } }
    mock_return = Mock(json=Mock(return_value=mock_user_contribs))
    return Mock(return_value=mock_return)


@pytest.mark.parametrize('year,month,day,expected', [
    (2020, 1, 1, (2020, 2)),
    (2020, 1, 31, (2020, 2)),
    (2020, 12, 1, (2021, 1))
])
def test_first_next_month(year, month, day, expected):
    utc = timezone.utc
    start = datetime(year, month, day, tzinfo=utc)
    expected = datetime(*expected, day=1, tzinfo=utc)
    assert first_next_month(start) == expected


def test_get_user_years(mock_user_years_query):
    with patch('ghcontribs.query.query', mock_user_years_query):
        years = get_user_years("dwhswenson", auth=("foo", "bar"))
    assert set(years) == {2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020,
                          2021}


def test_get_user_years_integration(authorization):
    years = get_user_years("dwhswenson", auth=authorization)
    assert len(years) >= 9
    assert min(years) == 2013
    assert DAVID_IS_DEAD or 0 <= datetime.now().year - max(years) <= 1


def test_get_monthly_contribs(mock_query):
    with patch('ghcontribs.query.query', mock_query):
        contribs = get_monthly_contribs("dwhswenson", 2016, 2,
                                        auth=("foo", "bar"))
    assert_mock_contribs(contribs)


def test_get_monthly_contribs_integration(authorization):
    contribs = get_monthly_contribs("dwhswenson", 2016, 2,
                                    auth=authorization)
    assert_feb_2016_contribs(contribs)


def test_month_year_generator():
    years = set(itertools.product(range(1, 13), [2014, 2015]))
    as_set = set(_month_year_generator([2014, 2015]))
    assert as_set == years
    assert len(as_set) == 24


def _mock_get_monthly_contribs(user, year, month, auth):
    if month == 5:
        return get_monthly_contribs(user, year, month, auth)
    else:
        return []


def test_write_all_contrib_files(tmpdir, mock_query):
    year_mock = Mock(return_value=[2014])
    with patch('ghcontribs.query.query', mock_query) as m_q, \
            patch('ghcontribs.monthly.get_user_years', year_mock) as m_y, \
            patch('ghcontribs.monthly.get_monthly_contribs',
                  _mock_get_monthly_contribs) as m_m:
        write_all_contrib_files(tmpdir, "dwhswenson", auth=("foo", "bar"))

    files = [f for f in pathlib.Path(tmpdir).iterdir()]
    assert len(files) == 1
    assert files[0].name == "2014-05.json"
