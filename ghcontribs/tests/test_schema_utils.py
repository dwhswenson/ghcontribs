import json
from pathlib import Path
from unittest.mock import patch

import pytest

from ghcontribs.schema_utils import (
    SCHEMA_FILENAMES,
    _schema_text,
    load_schemas,
    make_validator,
)


def test_loads_all_schemas_and_resolves_cross_schema_reference():
    schemas = load_schemas()

    assert tuple(schemas) == SCHEMA_FILENAMES
    make_validator('repository-details.schema.json').validate({
        'schema_version': 1,
        'key': 'owner/repo',
        'owner': 'owner',
        'name': 'repo',
        'contributions': [],
    })


def test_source_checkout_fallback_reads_canonical_schema():
    with patch(
        'ghcontribs.schema_utils.resources.files',
        side_effect=ModuleNotFoundError,
    ):
        schema = json.loads(_schema_text('contributions.schema.json'))

    assert schema['title'] == 'ghcontribs monthly contributions'


def test_unknown_schema_name_is_rejected():
    with pytest.raises(ValueError, match='Unknown ghcontribs schema'):
        _schema_text('../secret.json')


def test_checkout_fallback_requires_project_marker(tmp_path):
    fake_module = tmp_path / 'ghcontribs' / 'schema_utils.py'
    fake_module.parent.mkdir()
    fake_module.touch()
    with patch(
        'ghcontribs.schema_utils.resources.files',
        side_effect=ModuleNotFoundError,
    ), patch('ghcontribs.schema_utils.__file__', str(fake_module)):
        with pytest.raises(RuntimeError, match='schemas are missing'):
            _schema_text('contributions.schema.json')


def test_checkout_fallback_supports_src_layout_and_pyproject(tmp_path):
    fake_module = tmp_path / 'src' / 'ghcontribs' / 'schema_utils.py'
    fake_module.parent.mkdir(parents=True)
    fake_module.touch()
    (tmp_path / 'pyproject.toml').write_text('[build-system]\n')
    schema = tmp_path / 'schemas' / 'v1' / 'contributions.schema.json'
    schema.parent.mkdir(parents=True)
    schema.write_text('{"title": "src layout"}')

    with patch(
        'ghcontribs.schema_utils.resources.files',
        side_effect=ModuleNotFoundError,
    ), patch('ghcontribs.schema_utils.__file__', str(fake_module)):
        loaded = json.loads(_schema_text('contributions.schema.json'))

    assert loaded['title'] == 'src layout'
