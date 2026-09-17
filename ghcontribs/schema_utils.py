"""Load and validate the JSON contracts shipped with :mod:`ghcontribs`."""

import json
from importlib import resources
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource


SCHEMA_FILENAMES = (
    'contributions.schema.json',
    'visualization-index.schema.json',
    'repository-details.schema.json',
)


def _source_schema(filename: str) -> Path | None:
    """Find a canonical schema in a source or editable checkout."""
    for project_root in Path(__file__).resolve().parents:
        has_project_config = any(
            (project_root / marker).is_file()
            for marker in ('pyproject.toml', 'setup.cfg')
        )
        candidate = project_root / 'schemas' / 'v1' / filename
        if has_project_config and candidate.is_file():
            return candidate
    return None


def _schema_text(filename: str) -> str:
    if filename not in SCHEMA_FILENAMES:
        raise ValueError(f"Unknown ghcontribs schema: {filename!r}")

    try:
        resource = resources.files('ghcontribs._schemas.v1').joinpath(filename)
        return resource.read_text(encoding='utf-8')
    except ModuleNotFoundError:
        # A direct source-checkout invocation has no installed virtual package.
        source_schema = _source_schema(filename)
        if source_schema is None:
            raise RuntimeError(
                'ghcontribs schemas are missing from this installation'
            ) from None
        return source_schema.read_text(encoding='utf-8')


def load_schemas() -> dict[str, dict]:
    """Return all v1 schemas keyed by filename."""
    return {
        filename: json.loads(_schema_text(filename))
        for filename in SCHEMA_FILENAMES
    }


def make_validator(filename: str) -> Draft202012Validator:
    """Create a format-checking validator with local references registered."""
    schemas = load_schemas()
    registry = Registry().with_resources(
        (
            schema['$id'],
            Resource.from_contents(schema),
        )
        for schema in schemas.values()
    )
    return Draft202012Validator(
        schemas[filename],
        registry=registry,
        format_checker=FormatChecker(),
    )
