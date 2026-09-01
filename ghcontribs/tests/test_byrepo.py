import json
import os
from pathlib import Path
from threading import Event, Thread
from unittest.mock import patch

import pytest

from ghcontribs.byrepo import (
    ByRepoError,
    build_dataset,
    organize_contributions,
)


FIXTURES = Path(__file__).parent / 'fixtures' / 'byrepo'


def issue(
    *,
    owner='ExampleOrg',
    repo='example-repo',
    number=1,
    created='2024-01-02T12:00:00+00:00',
    url=None,
    title='An issue',
):
    return {
        'url': url or f'https://github.com/{owner}/{repo}/issues/{number}',
        'created': created,
        'contrib_type': 'issue',
        'owner': owner,
        'repo': repo,
        'number': number,
        'title': title,
    }


def pull_request(**overrides):
    record = issue(number=2, title='A pull request')
    record.update({
        'url': 'https://github.com/ExampleOrg/example-repo/pull/2',
        'created': '2024-01-03T12:00:00+00:00',
        'contrib_type': 'pullRequest',
        'merged': True,
        'closes': [issue(number=9, title='Nested closing issue')],
    })
    record.update(overrides)
    return record


def all_types():
    pr = pull_request()
    return [
        issue(),
        pr,
        {
            'url': f"{pr['url']}#pullrequestreview-3",
            'created': '2024-01-04T12:00:00+00:00',
            'contrib_type': 'pullRequestReview',
            'pr': pr,
        },
        {
            'url': f"{pr['url']}#issuecomment-4",
            'created': '2024-01-05T12:00:00+00:00',
            'contrib_type': 'issueComment',
            'issue_or_pr': pr,
        },
    ]


def write_month(directory, month, records):
    directory.mkdir(parents=True, exist_ok=True)
    (directory / f'{month}.json').write_text(json.dumps(records))


def test_build_dataset_counts_only_top_level_records(tmp_path):
    write_month(tmp_path, '2024-01', all_types())
    write_month(tmp_path, '2024-02', [])

    index, details = build_dataset('octocat', tmp_path)

    repository = index['owners'][0]['repositories'][0]
    assert repository['contributions'] == {
        'total': {
            'issues': 1,
            'pull_requests': 1,
            'reviews': 1,
            'comments': 1,
        },
        'by_month': {
            '2024-01': {
                'issues': 1,
                'pull_requests': 1,
                'reviews': 1,
                'comments': 1,
            }
        },
    }
    assert index['source'] == {
        'first_month': '2024-01',
        'last_month': '2024-02',
    }
    assert len(details['ExampleOrg/example-repo']['contributions']) == 4


def test_archive_is_read_once(tmp_path):
    archive = tmp_path / '2024-01.json'
    write_month(tmp_path, '2024-01', [issue()])
    real_read_text = Path.read_text
    archive_reads = 0

    def count_archive_reads(path, *args, **kwargs):
        nonlocal archive_reads
        if path == archive:
            archive_reads += 1
        return real_read_text(path, *args, **kwargs)

    with patch.object(Path, 'read_text', count_archive_reads):
        build_dataset('octocat', tmp_path)

    assert archive_reads == 1


@pytest.mark.parametrize(
    'filename',
    ['notes.json', '2024-00.json', '2024-13.json', '0000-01.json'],
)
def test_rejects_invalid_monthly_filename(tmp_path, filename):
    (tmp_path / filename).write_text('[]')

    with pytest.raises(ByRepoError, match='filename|calendar month'):
        build_dataset('octocat', tmp_path)


def test_ignores_non_json_files(tmp_path):
    write_month(tmp_path, '2024-01', [])
    (tmp_path / 'README.txt').write_text('ignored')

    index, _ = build_dataset('octocat', tmp_path)

    assert index['owners'] == []


def test_empty_dataset_emits_repositories_directory(tmp_path):
    source = tmp_path / 'source'
    output = tmp_path / 'output'
    write_month(source, '2024-01', [])

    organize_contributions('octocat', source, output)

    assert (output / 'repos').is_dir()
    assert list((output / 'repos').iterdir()) == []


def test_rejects_empty_archive_directory(tmp_path):
    with pytest.raises(ByRepoError, match='no monthly JSON archives'):
        build_dataset('octocat', tmp_path)


def test_uses_utc_for_month_membership(tmp_path):
    write_month(
        tmp_path,
        '2024-01',
        [issue(created='2024-02-01T00:30:00+01:00')],
    )
    build_dataset('octocat', tmp_path)

    other = tmp_path / 'other'
    write_month(
        other,
        '2024-02',
        [issue(created='2024-02-01T00:30:00+01:00')],
    )
    with pytest.raises(ByRepoError, match='belongs to UTC month 2024-01'):
        build_dataset('octocat', other)


def test_identical_duplicate_url_is_coalesced(tmp_path):
    record = issue()
    write_month(tmp_path, '2024-01', [record, record])

    index, details = build_dataset('octocat', tmp_path)

    total = index['owners'][0]['repositories'][0]['contributions']['total']
    assert total['issues'] == 1
    assert len(details['ExampleOrg/example-repo']['contributions']) == 1


def test_owners_repositories_and_details_are_sorted_deterministically(tmp_path):
    records = [
        issue(
            owner='z-owner',
            repo='z-repo',
            number=3,
            created='2024-01-03T12:00:00+00:00',
        ),
        issue(owner='A-owner', repo='z-repo', number=2),
        issue(owner='A-owner', repo='Alpha', number=1),
        issue(
            owner='z-owner',
            repo='z-repo',
            number=1,
            created='2024-01-01T12:00:00+00:00',
        ),
    ]
    write_month(tmp_path, '2024-01', records)

    index, details = build_dataset('octocat', tmp_path)

    assert [owner['owner'] for owner in index['owners']] == [
        'A-owner',
        'z-owner',
    ]
    assert [
        repo['name'] for repo in index['owners'][0]['repositories']
    ] == ['Alpha', 'z-repo']
    assert [
        record['number']
        for record in details['z-owner/z-repo']['contributions']
    ] == [1, 3]


def test_conflicting_duplicate_url_is_rejected(tmp_path):
    first = issue()
    second = issue(title='Different content')
    write_month(tmp_path, '2024-01', [first, second])

    with pytest.raises(ByRepoError, match='conflicting records share URL'):
        build_dataset('octocat', tmp_path)


@pytest.mark.parametrize(
    'records,message',
    [
        ([issue(), issue(owner='exampleorg', number=2)], 'owner spelling'),
        ([issue(), issue(repo='Example-Repo', number=2)], 'repository spelling'),
        ([issue(owner='..')], 'unsafe owner'),
        ([issue(
            repo=r'bad\\name',
            url='https://github.com/ExampleOrg/safe/issues/1',
        )], 'unsafe repository'),
    ],
)
def test_rejects_identity_collisions_and_unsafe_paths(tmp_path, records, message):
    write_month(tmp_path, '2024-01', records)

    with pytest.raises(ByRepoError, match=message):
        build_dataset('octocat', tmp_path)


def test_schema_validation_has_filename_context(tmp_path):
    record = issue()
    record.pop('title')
    write_month(tmp_path, '2024-01', [record])

    with pytest.raises(ByRepoError, match='2024-01.json violates'):
        build_dataset('octocat', tmp_path)


def test_force_replaces_complete_tree_and_removes_stale_files(tmp_path):
    source = tmp_path / 'source'
    output = tmp_path / 'output'
    write_month(source, '2024-01', [issue()])
    output.mkdir()
    (output / 'stale.json').write_text('{}')

    with pytest.raises(ByRepoError, match='use --force'):
        organize_contributions('octocat', source, output)

    organize_contributions('octocat', source, output, force=True)

    assert not (output / 'stale.json').exists()
    assert (output / 'index.json').is_file()
    assert (output / 'repos' / 'ExampleOrg' / 'example-repo.json').is_file()


def test_rechecks_destination_after_build_before_unforced_install(tmp_path):
    source = tmp_path / 'source'
    output = tmp_path / 'output'
    write_month(source, '2024-01', [issue()])
    real_build_dataset = build_dataset

    def create_destination_during_build(*args, **kwargs):
        result = real_build_dataset(*args, **kwargs)
        output.mkdir()
        (output / 'concurrent.txt').write_text('keep me')
        return result

    with patch(
        'ghcontribs.byrepo.build_dataset',
        side_effect=create_destination_during_build,
    ):
        with pytest.raises(ByRepoError, match='use --force'):
            organize_contributions('octocat', source, output)

    assert (output / 'concurrent.txt').read_text() == 'keep me'
    assert not list(tmp_path.glob('.output.tmp-*'))


def test_installations_for_same_output_are_serialized(tmp_path):
    source = tmp_path / 'source'
    output = tmp_path / 'output'
    write_month(source, '2024-01', [issue()])
    first_swap_started = Event()
    allow_first_swap = Event()
    real_replace = os.replace
    errors = []
    calls = 0

    def pause_first_install(source_path, destination_path):
        nonlocal calls
        if Path(destination_path) == output:
            calls += 1
            if calls == 1:
                first_swap_started.set()
                assert allow_first_swap.wait(timeout=5)
        return real_replace(source_path, destination_path)

    def run_organizer():
        try:
            organize_contributions('octocat', source, output, force=True)
        except BaseException as exc:  # pragma: no cover - asserted below
            errors.append(exc)

    with patch('ghcontribs.byrepo.os.replace', side_effect=pause_first_install):
        first = Thread(target=run_organizer)
        second = Thread(target=run_organizer)
        first.start()
        assert first_swap_started.wait(timeout=5)
        second.start()
        allow_first_swap.set()
        first.join(timeout=5)
        second.join(timeout=5)

    assert not first.is_alive()
    assert not second.is_alive()
    assert errors == []
    assert (output / 'index.json').is_file()
    assert not list(tmp_path.glob('.output.backup-*'))


def test_rejects_overlapping_and_symlinked_output(tmp_path):
    source = tmp_path / 'source'
    write_month(source, '2024-01', [])

    with pytest.raises(ByRepoError, match='must not overlap'):
        organize_contributions('octocat', source, source / 'output')

    link = tmp_path / 'link'
    try:
        link.symlink_to(tmp_path / 'target', target_is_directory=True)
    except OSError:
        pytest.skip('symlinks unavailable')
    with pytest.raises(ByRepoError, match='must not be a symlink'):
        organize_contributions('octocat', source, link)


def test_failed_swap_restores_previous_output(tmp_path):
    source = tmp_path / 'source'
    output = tmp_path / 'output'
    write_month(source, '2024-01', [issue()])
    output.mkdir()
    (output / 'previous.txt').write_text('previous')
    real_replace = os.replace
    calls = 0

    def fail_stage_swap(source_path, destination_path):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError('simulated swap failure')
        return real_replace(source_path, destination_path)

    with patch('ghcontribs.byrepo.os.replace', side_effect=fail_stage_swap):
        with pytest.raises(OSError, match='simulated swap failure'):
            organize_contributions('octocat', source, output, force=True)

    assert (output / 'previous.txt').read_text() == 'previous'
    assert not list(tmp_path.glob('.output.backup-*'))


def test_golden_directory_and_repeat_build_are_deterministic(tmp_path):
    first = tmp_path / 'first'
    second = tmp_path / 'second'
    organize_contributions('octocat', FIXTURES / 'input', first)
    organize_contributions('octocat', FIXTURES / 'input', second)

    expected_files = sorted(
        path.relative_to(FIXTURES / 'expected')
        for path in (FIXTURES / 'expected').rglob('*')
        if path.is_file()
    )
    first_files = sorted(
        path.relative_to(first) for path in first.rglob('*') if path.is_file()
    )
    assert first_files == expected_files
    for relative in expected_files:
        expected = (FIXTURES / 'expected' / relative).read_bytes()
        assert (first / relative).read_bytes() == expected
        assert (second / relative).read_bytes() == expected


def test_non_ascii_data_round_trips_as_utf8(tmp_path):
    source = tmp_path / 'source'
    output = tmp_path / 'output'
    write_month(source, '2024-01', [issue(title='Café Δ')])

    organize_contributions('octocat', source, output)

    detail = json.loads(
        (output / 'repos' / 'ExampleOrg' / 'example-repo.json').read_text(
            encoding='utf-8'
        )
    )
    assert detail['contributions'][0]['title'] == 'Café Δ'
