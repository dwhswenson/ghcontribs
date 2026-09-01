"""Organize monthly contribution archives for the browser visualization."""

import argparse
import json
import os
import re
import shutil
import tempfile
import uuid
from dataclasses import dataclass, field
from datetime import timezone
from pathlib import Path
from typing import Any

from filelock import FileLock
from jsonschema import ValidationError

from .contrib import Contribution
from .schema_utils import make_validator


SCHEMA_VERSION = 1
_MONTH_FILENAME = re.compile(r'^(?P<year>[0-9]{4})-(?P<month>[0-9]{2})\.json$')
_COUNT_KEY = {
    'issue': 'issues',
    'pullRequest': 'pull_requests',
    'pullRequestReview': 'reviews',
    'issueComment': 'comments',
}


class ByRepoError(ValueError):
    """Raised when an archive cannot be organized safely."""


def _zero_counts() -> dict[str, int]:
    return {
        'issues': 0,
        'pull_requests': 0,
        'reviews': 0,
        'comments': 0,
    }


def _safe_component(value: str, label: str) -> None:
    if value in {'.', '..'} or '/' in value or '\\' in value or '\x00' in value:
        raise ByRepoError(f'unsafe {label} path component: {value!r}')


def _month_from_filename(path: Path) -> str:
    match = _MONTH_FILENAME.fullmatch(path.name)
    if match is None:
        raise ByRepoError(
            f'JSON archive filename must be YYYY-MM.json: {path.name!r}'
        )
    year = int(match.group('year'))
    month = int(match.group('month'))
    if year < 1 or not 1 <= month <= 12:
        raise ByRepoError(f'invalid calendar month in filename: {path.name!r}')
    return path.stem


def _discover_months(input_directory: Path) -> list[tuple[str, Path]]:
    if not input_directory.is_dir():
        raise ByRepoError(f'input directory does not exist: {input_directory}')

    json_paths = sorted(input_directory.glob('*.json'), key=lambda path: path.name)
    months = []
    for path in json_paths:
        if not path.is_file():
            raise ByRepoError(f'archive is not a regular file: {path}')
        months.append((_month_from_filename(path), path))
    if not months:
        raise ByRepoError('input directory contains no monthly JSON archives')
    return months


def _repository_identity(contribution: Contribution) -> tuple[str, str]:
    try:
        owner = contribution.owner
        repository = contribution.repo
    except AttributeError as exc:  # pragma: no cover - model invariant
        raise ByRepoError(
            f'cannot determine repository for {contribution.contrib_type!r}'
        ) from exc
    _safe_component(owner, 'owner')
    _safe_component(repository, 'repository')
    return owner, repository


@dataclass
class _Repository:
    owner: str
    name: str
    total: dict[str, int] = field(default_factory=_zero_counts)
    by_month: dict[str, dict[str, int]] = field(default_factory=dict)
    records: list[tuple[Contribution, dict[str, Any]]] = field(
        default_factory=list
    )

    def add(
        self,
        contribution: Contribution,
        raw_record: dict[str, Any],
        month: str,
    ) -> None:
        count_key = _COUNT_KEY[contribution.contrib_type]
        self.total[count_key] += 1
        monthly = self.by_month.setdefault(month, _zero_counts())
        monthly[count_key] += 1
        self.records.append((contribution, raw_record))


def _schema_error(path: Path, error: ValidationError) -> ByRepoError:
    location = ''.join(f'[{part!r}]' for part in error.absolute_path)
    suffix = f' at {location}' if location else ''
    return ByRepoError(
        f'{path.name} violates contribution schema{suffix}: {error.message}'
    )


def build_dataset(
    user: str,
    input_directory: str | os.PathLike[str],
) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    """Build an index and repository details from monthly source archives."""
    if not user:
        raise ByRepoError('username must not be empty')

    months = _discover_months(Path(input_directory))
    input_validator = make_validator('contributions.schema.json')
    seen_urls: dict[str, dict[str, Any]] = {}
    owner_spellings: dict[str, str] = {}
    repository_spellings: dict[tuple[str, str], tuple[str, str]] = {}
    repositories: dict[tuple[str, str], _Repository] = {}

    for month, path in months:
        try:
            raw_records = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise ByRepoError(f'cannot read {path.name}: {exc}') from exc
        try:
            input_validator.validate(raw_records)
        except ValidationError as exc:
            raise _schema_error(path, exc) from exc

        try:
            rich_records = [
                Contribution.from_dict(record) for record in raw_records
            ]
        except (TypeError, ValueError) as exc:
            raise ByRepoError(
                f'cannot decode contributions in {path.name}: {exc}'
            ) from exc
        if not isinstance(rich_records, list):  # schema also enforces this
            raise ByRepoError(f'{path.name} must contain a JSON array')

        for raw_record, contribution in zip(raw_records, rich_records, strict=True):
            if not isinstance(contribution, Contribution):  # pragma: no cover
                raise ByRepoError(f'{path.name} contains a non-contribution record')
            created_utc = contribution.created.astimezone(timezone.utc)
            created_month = f'{created_utc.year:04}-{created_utc.month:02}'
            if created_month != month:
                raise ByRepoError(
                    f'{contribution.url!r} belongs to UTC month {created_month}, '
                    f'not source month {month}'
                )

            owner, repository = _repository_identity(contribution)
            owner_folded = owner.casefold()
            prior_owner = owner_spellings.setdefault(owner_folded, owner)
            if prior_owner != owner:
                raise ByRepoError(
                    f'inconsistent owner spelling: {prior_owner!r} and {owner!r}'
                )
            folded_key = (owner_folded, repository.casefold())
            prior_identity = repository_spellings.setdefault(
                folded_key, (owner, repository)
            )
            if prior_identity != (owner, repository):
                prior_key = '/'.join(prior_identity)
                current_key = f'{owner}/{repository}'
                raise ByRepoError(
                    f'inconsistent repository spelling: {prior_key!r} and '
                    f'{current_key!r}'
                )

            prior_record = seen_urls.get(contribution.url)
            if prior_record is not None:
                if prior_record != raw_record:
                    raise ByRepoError(
                        f'conflicting records share URL {contribution.url!r}'
                    )
                continue
            seen_urls[contribution.url] = raw_record

            aggregate = repositories.setdefault(
                (owner, repository), _Repository(owner, repository)
            )
            aggregate.add(contribution, raw_record, month)

    owner_repositories: dict[str, list[_Repository]] = {}
    details: dict[str, dict[str, Any]] = {}
    for aggregate in repositories.values():
        owner_repositories.setdefault(aggregate.owner, []).append(aggregate)
        key = f'{aggregate.owner}/{aggregate.name}'
        sorted_records = sorted(
            aggregate.records,
            key=lambda pair: (
                pair[0].created.astimezone(timezone.utc),
                pair[0].url,
                pair[0].contrib_type,
            ),
        )
        details[key] = {
            'schema_version': SCHEMA_VERSION,
            'key': key,
            'owner': aggregate.owner,
            'name': aggregate.name,
            'contributions': [raw for _, raw in sorted_records],
        }

    owners = []
    for owner in sorted(owner_repositories, key=lambda name: (name.casefold(), name)):
        repo_summaries = []
        for aggregate in sorted(
            owner_repositories[owner],
            key=lambda repo: (repo.name.casefold(), repo.name),
        ):
            key = f'{owner}/{aggregate.name}'
            repo_summaries.append({
                'key': key,
                'name': aggregate.name,
                'contributions': {
                    'total': aggregate.total,
                    'by_month': {
                        month: aggregate.by_month[month]
                        for month in sorted(aggregate.by_month)
                    },
                },
            })
        owners.append({'owner': owner, 'repositories': repo_summaries})

    index = {
        'schema_version': SCHEMA_VERSION,
        'user': user,
        'source': {
            'first_month': months[0][0],
            'last_month': months[-1][0],
        },
        'owners': owners,
    }
    return index, details


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )


def _validate_output(index: dict, details: dict[str, dict]) -> None:
    make_validator('visualization-index.schema.json').validate(index)
    details_validator = make_validator('repository-details.schema.json')
    for detail in details.values():
        details_validator.validate(detail)


def _paths_overlap(first: Path, second: Path) -> bool:
    return first == second or first in second.parents or second in first.parents


def organize_contributions(
    user: str,
    input_directory: str | os.PathLike[str],
    output_directory: str | os.PathLike[str],
    *,
    force: bool = False,
) -> None:
    """Build, validate, and transactionally install a visualization dataset."""
    input_path = Path(input_directory).resolve()
    output_path = Path(output_directory)
    if output_path.is_symlink():
        raise ByRepoError(f'output directory must not be a symlink: {output_path}')
    output_resolved = output_path.resolve(strict=False)
    if _paths_overlap(input_path, output_resolved):
        raise ByRepoError('input and output directories must not overlap')
    if output_path.exists():
        if not output_path.is_dir():
            raise ByRepoError(f'output path is not a directory: {output_path}')
        if not force:
            raise ByRepoError(
                f'output directory already exists: {output_path}; use --force '
                'to replace it'
            )

    index, details = build_dataset(user, input_path)
    try:
        _validate_output(index, details)
    except ValidationError as exc:  # pragma: no cover - implementation defect
        raise ByRepoError(f'organizer produced invalid output: {exc.message}') from exc

    parent = output_path.parent
    parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=f'.{output_path.name}.tmp-', dir=parent))
    backup = parent / f'.{output_path.name}.backup-{uuid.uuid4().hex}'
    try:
        _write_json(stage / 'index.json', index)
        (stage / 'repos').mkdir()
        for key in sorted(details, key=lambda item: (item.casefold(), item)):
            owner, repository = key.split('/', 1)
            _write_json(stage / 'repos' / owner / f'{repository}.json', details[key])

        # Validate serialized output too, guarding the emitter boundary.
        serialized_index = json.loads(
            (stage / 'index.json').read_text(encoding='utf-8')
        )
        serialized_details = {
            key: json.loads(
                (stage / 'repos' / key.split('/', 1)[0] /
                 f"{key.split('/', 1)[1]}.json").read_text(encoding='utf-8')
            )
            for key in details
        }
        _validate_output(serialized_index, serialized_details)

        lock = FileLock(parent / f'.{output_path.name}.lock')
        with lock:
            if output_path.exists():
                if not output_path.is_dir():
                    raise ByRepoError(
                        f'output path is not a directory: {output_path}'
                    )
                if not force:
                    raise ByRepoError(
                        f'output directory already exists: {output_path}; '
                        'use --force to replace it'
                    )
                os.replace(output_path, backup)
                try:
                    os.replace(stage, output_path)
                except BaseException:
                    os.replace(backup, output_path)
                    raise
                shutil.rmtree(backup)
            else:
                os.replace(stage, output_path)
    finally:
        if stage.exists():
            shutil.rmtree(stage)


def main(args=None) -> None:
    parser = argparse.ArgumentParser(
        description='Reorganize monthly GitHub contributions for visualization.'
    )
    parser.add_argument('username')
    parser.add_argument(
        '--input-directory',
        default='contributions',
        help='Directory containing YYYY-MM.json archives (default: contributions).',
    )
    parser.add_argument(
        '--output-directory',
        default='dist-data',
        help='Generated dataset directory (default: dist-data).',
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Replace an existing output directory after a complete valid build.',
    )
    opts = parser.parse_args(args)
    try:
        organize_contributions(
            opts.username,
            opts.input_directory,
            opts.output_directory,
            force=opts.force,
        )
    except (ByRepoError, OSError, ValidationError) as exc:
        parser.error(str(exc))


if __name__ == '__main__':
    main()
