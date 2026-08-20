import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

import pytest

from ghcontribs.contrib import Comment, Issue, PullRequest, Review
from ghcontribs.monthly import (
    _month_year_generator,
    first_next_month,
    get_monthly_contribs,
    get_user_years,
    main,
    write_all_contrib_files,
)


UTC = timezone.utc


@pytest.fixture
def mock_user_years_query():
    data = {
        'data': {
            'user': {
                'contributionsCollection': {
                    'contributionYears': [
                        2021, 2020, 2019, 2018, 2017,
                        2016, 2015, 2014, 2013,
                    ]
                }
            }
        }
    }
    response = Mock()
    response.json.return_value = data
    return Mock(return_value=response)


def make_issue():
    return Issue(
        created=datetime(2026, 5, 10, tzinfo=UTC),
        url='https://github.com/org/repo/issues/1',
        owner='org',
        repo='repo',
        number=1,
        title='Issue',
    )


def make_contribs():
    issue = make_issue()
    pr = PullRequest(
        created=datetime(2026, 5, 11, tzinfo=UTC),
        url='https://github.com/org/repo/pull/2',
        owner='org',
        repo='repo',
        number=2,
        title='Pull request',
        merged=True,
        closes=(issue,),
    )
    review = Review(
        created=datetime(2026, 5, 12, tzinfo=UTC),
        url=f'{pr.url}#pullrequestreview-3',
        pr=pr,
    )
    comment = Comment(
        created=datetime(2026, 5, 13, tzinfo=UTC),
        url=f'{pr.url}#issuecomment-4',
        issue_or_pr=pr,
    )
    return issue, pr, review, comment


@pytest.mark.parametrize(
    'date,expected',
    [
        (datetime(2020, 1, 31, tzinfo=UTC), datetime(2020, 2, 1, tzinfo=UTC)),
        (datetime(2020, 2, 29, tzinfo=UTC), datetime(2020, 3, 1, tzinfo=UTC)),
        (datetime(2020, 12, 1, tzinfo=UTC), datetime(2021, 1, 1, tzinfo=UTC)),
    ],
)
def test_first_next_month(date, expected):
    assert first_next_month(date) == expected


def test_get_user_years_checks_response(mock_user_years_query):
    with patch('ghcontribs.query.query', mock_user_years_query):
        years = get_user_years('octocat', auth=('user', 'token'))

    assert years == [2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013]
    mock_user_years_query.return_value.raise_for_status.assert_called_once_with()


def test_get_monthly_contribs_uses_inclusive_month_bounds():
    with patch(
        'ghcontribs.monthly.get_contributions',
        return_value=(make_issue(),),
    ) as get_contributions:
        result = get_monthly_contribs('octocat', 2024, 2, ('user', 'token'))

    assert result == (make_issue(),)
    get_contributions.assert_called_once_with(
        'octocat',
        datetime(2024, 2, 1, tzinfo=UTC),
        datetime(2024, 2, 29, 23, 59, 59, 999999, tzinfo=UTC),
        ('user', 'token'),
        comments=True,
    )


def test_get_monthly_contribs_can_exclude_comments():
    with patch(
        'ghcontribs.monthly.get_contributions',
        return_value=(),
    ) as get_contributions:
        get_monthly_contribs(
            'octocat',
            2024,
            2,
            ('user', 'token'),
            comments=False,
        )

    assert get_contributions.call_args.kwargs == {'comments': False}


def test_adjacent_month_ranges_do_not_overlap():
    with patch(
        'ghcontribs.monthly.get_contributions', return_value=()
    ) as get_contributions:
        get_monthly_contribs('octocat', 2024, 1, ('user', 'token'))
        get_monthly_contribs('octocat', 2024, 2, ('user', 'token'))

    january = get_contributions.call_args_list[0].args
    february = get_contributions.call_args_list[1].args
    assert february[1] - january[2] == datetime.resolution


def test_month_year_generator_sorts_and_caps_at_current_month():
    current = datetime(2026, 8, 18, tzinfo=UTC)

    months = list(_month_year_generator([2026, 2024, 2024, 2027], current))

    assert months[:2] == [(1, 2024), (2, 2024)]
    assert months[11] == (12, 2024)
    assert months[12:] == [(month, 2026) for month in range(1, 9)]


def test_write_all_contrib_files_includes_empty_months_and_creates_directory(
    tmp_path,
):
    output = tmp_path / 'nested' / 'monthly'

    issue, pull_request, review, comment = make_contribs()

    def monthly(_user, _year, month, _auth, *, comments):
        assert comments is False
        return (issue, pull_request, review) if month == 5 else ()

    with patch('ghcontribs.monthly.get_user_years', return_value=[2026]), patch(
        'ghcontribs.monthly.get_comments', return_value=(comment,)
    ) as get_comments, patch(
        'ghcontribs.monthly.get_monthly_contribs', side_effect=monthly
    ), patch(
        'ghcontribs.monthly._current_utc_datetime',
        return_value=datetime(2026, 8, 18, tzinfo=UTC),
    ):
        write_all_contrib_files(output, 'octocat', ('user', 'token'))

    files = sorted(output.iterdir())
    assert [file.name for file in files] == [
        f'2026-{month:02}.json' for month in range(1, 9)
    ]
    assert json.loads((output / '2026-01.json').read_text()) == []
    may_data = json.loads((output / '2026-05.json').read_text())
    assert [item['contrib_type'] for item in may_data] == [
        'issue', 'pullRequest', 'pullRequestReview', 'issueComment'
    ]
    assert may_data[0]['created'] == '2026-05-10T00:00:00+00:00'
    get_comments.assert_called_once_with(
        'octocat',
        datetime(2026, 1, 1, tzinfo=UTC),
        datetime(2026, 8, 31, 23, 59, 59, 999999, tzinfo=UTC),
        ('user', 'token'),
    )


def test_write_all_contrib_files_buckets_comments_by_utc_month(tmp_path):
    target = make_issue()
    comment = Comment(
        created=datetime(
            2026,
            6,
            1,
            1,
            tzinfo=timezone(timedelta(hours=2)),
        ),
        url=f'{target.url}#issuecomment-5',
        issue_or_pr=target,
    )
    with patch('ghcontribs.monthly.get_user_years', return_value=[2026]), patch(
        'ghcontribs.monthly.get_comments', return_value=(comment,)
    ) as get_comments, patch(
        'ghcontribs.monthly.get_monthly_contribs', return_value=()
    ) as get_monthly, patch(
        'ghcontribs.monthly._current_utc_datetime',
        return_value=datetime(2026, 6, 15, tzinfo=UTC),
    ):
        write_all_contrib_files(tmp_path, 'octocat', ('user', 'token'))

    may = json.loads((tmp_path / '2026-05.json').read_text())
    june = json.loads((tmp_path / '2026-06.json').read_text())
    assert [record['url'] for record in may] == [comment.url]
    assert june == []
    assert get_comments.call_count == 1
    assert get_monthly.call_count == 6


def test_write_all_contrib_files_with_no_years_skips_comment_query(tmp_path):
    with patch('ghcontribs.monthly.get_user_years', return_value=[]), patch(
        'ghcontribs.monthly.get_comments'
    ) as get_comments:
        write_all_contrib_files(tmp_path, 'octocat', ('user', 'token'))

    get_comments.assert_not_called()
    assert list(tmp_path.iterdir()) == []


def test_main_prefers_explicit_token_and_forwards_output_directory():
    with patch.dict('os.environ', {'GHCONTRIBS_TOKEN': 'environment'}), patch(
        'ghcontribs.monthly.write_all_contrib_files'
    ) as write_files:
        main([
            'octocat',
            '--auth-user',
            'auth-user',
            '--token',
            'explicit',
            '--output-directory',
            'out',
        ])

    write_files.assert_called_once_with(
        directory='out', user='octocat', auth=('auth-user', 'explicit')
    )


def test_main_uses_environment_token_and_username_as_auth_user():
    with patch.dict('os.environ', {'GHCONTRIBS_TOKEN': 'environment'}), patch(
        'ghcontribs.monthly.write_all_contrib_files'
    ) as write_files:
        main(['octocat'])

    write_files.assert_called_once_with(
        directory='.', user='octocat', auth=('octocat', 'environment')
    )


def test_main_rejects_missing_token(capsys):
    with patch.dict('os.environ', {}, clear=True), pytest.raises(SystemExit) as exc:
        main(['octocat'])

    assert exc.value.code == 2
    assert 'missing authorization token' in capsys.readouterr().err


def test_module_help_does_not_warn_about_prior_import():
    result = subprocess.run(
        [sys.executable, '-W', 'error::RuntimeWarning', '-m',
         'ghcontribs.monthly', '--help'],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert 'RuntimeWarning' not in result.stderr
