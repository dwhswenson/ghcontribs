import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, FormatChecker, ValidationError
from referencing import Registry, Resource


SCHEMA_DIRECTORY = Path(__file__).parents[2] / 'schemas' / 'v1'
SCHEMA_FILENAMES = (
    'contributions.schema.json',
    'visualization-index.schema.json',
    'repository-details.schema.json',
)


@pytest.fixture(scope='module')
def schemas():
    return {
        filename: json.loads((SCHEMA_DIRECTORY / filename).read_text())
        for filename in SCHEMA_FILENAMES
    }


@pytest.fixture(scope='module')
def registry(schemas):
    return Registry().with_resources(
        (
            schema['$id'],
            Resource.from_contents(schema),
        )
        for schema in schemas.values()
    )


@pytest.fixture(scope='module')
def index_validator(schemas, registry):
    return Draft202012Validator(
        schemas['visualization-index.schema.json'],
        registry=registry,
        format_checker=FormatChecker(),
    )


@pytest.fixture(scope='module')
def details_validator(schemas, registry):
    return Draft202012Validator(
        schemas['repository-details.schema.json'],
        registry=registry,
        format_checker=FormatChecker(),
    )


@pytest.fixture
def counts():
    return {
        'issues': 1,
        'pull_requests': 2,
        'reviews': 3,
        'comments': 4,
    }


@pytest.fixture
def populated_index(counts):
    return {
        'schema_version': 1,
        'user': 'octocat',
        'source': {
            'first_month': '2024-01',
            'last_month': '2024-12',
        },
        'owners': [
            {
                'owner': 'ExampleOrg',
                'repositories': [
                    {
                        'key': 'ExampleOrg/example-repo',
                        'name': 'example-repo',
                        'contributions': {
                            'total': counts,
                            'by_month': {
                                '2024-01': counts,
                            },
                        },
                    }
                ],
            }
        ],
    }


@pytest.fixture
def contribution_variants():
    issue = {
        'url': 'https://github.com/ExampleOrg/example-repo/issues/1',
        'created': '2024-01-01T12:00:00+00:00',
        'contrib_type': 'issue',
        'owner': 'ExampleOrg',
        'repo': 'example-repo',
        'number': 1,
        'title': 'An issue',
    }
    pull_request = {
        'url': 'https://github.com/ExampleOrg/example-repo/pull/2',
        'created': '2024-01-02T12:00:00+00:00',
        'contrib_type': 'pullRequest',
        'owner': 'ExampleOrg',
        'repo': 'example-repo',
        'number': 2,
        'title': 'A pull request',
        'merged': True,
        'closes': [issue],
    }
    review = {
        'url': f"{pull_request['url']}#pullrequestreview-3",
        'created': '2024-01-03T12:00:00+00:00',
        'contrib_type': 'pullRequestReview',
        'pr': pull_request,
    }
    comment = {
        'url': f"{issue['url']}#issuecomment-4",
        'created': '2024-01-04T12:00:00+00:00',
        'contrib_type': 'issueComment',
        'issue_or_pr': issue,
    }
    return [issue, pull_request, review, comment]


@pytest.fixture
def repository_details(contribution_variants):
    return {
        'schema_version': 1,
        'key': 'ExampleOrg/example-repo',
        'owner': 'ExampleOrg',
        'name': 'example-repo',
        'contributions': contribution_variants,
    }


def test_schemas_are_valid_draft_2020_12(schemas):
    for schema in schemas.values():
        Draft202012Validator.check_schema(schema)


def test_populated_index_is_valid(index_validator, populated_index):
    index_validator.validate(populated_index)


def test_empty_and_zero_valued_index_is_valid(index_validator):
    index_validator.validate(
        {
            'schema_version': 1,
            'user': 'octocat',
            'source': {
                'first_month': '2024-01',
                'last_month': '2024-01',
            },
            'owners': [
                {
                    'owner': 'ExampleOrg',
                    'repositories': [
                        {
                            'key': 'ExampleOrg/example-repo',
                            'name': 'example-repo',
                            'contributions': {
                                'total': {
                                    'issues': 0,
                                    'pull_requests': 0,
                                    'reviews': 0,
                                    'comments': 0,
                                },
                                'by_month': {
                                    '2024-01': {
                                        'issues': 0,
                                        'pull_requests': 0,
                                        'reviews': 0,
                                        'comments': 0,
                                    }
                                },
                            },
                        }
                    ],
                },
                {
                    'owner': 'EmptyOrg',
                    'repositories': [],
                },
            ],
        }
    )

    index_validator.validate(
        {
            'schema_version': 1,
            'user': 'octocat',
            'source': {
                'first_month': '2024-01',
                'last_month': '2024-01',
            },
            'owners': [],
        }
    )


def _invalid_index(populated_index, mutation):
    invalid = copy.deepcopy(populated_index)
    mutation(invalid)
    return invalid


@pytest.mark.parametrize(
    'mutation',
    [
        lambda data: data.update(schema_version=2),
        lambda data: data.pop('user'),
        lambda data: data.update(unexpected=True),
        lambda data: data['source'].update(first_month='2024-13'),
        lambda data: data['owners'][0]['repositories'][0].update(
            key='ExampleOrg/example-repo/extra'
        ),
        lambda data: data['owners'][0]['repositories'][0][
            'contributions'
        ]['total'].update(issues=-1),
        lambda data: data['owners'][0]['repositories'][0][
            'contributions'
        ]['total'].pop('comments'),
        lambda data: data['owners'][0]['repositories'][0][
            'contributions'
        ]['by_month'].update(
            {
                'January 2024': {
                    'issues': 0,
                    'pull_requests': 0,
                    'reviews': 0,
                    'comments': 0,
                }
            }
        ),
    ],
)
def test_invalid_indexes_are_rejected(
    index_validator,
    populated_index,
    mutation,
):
    with pytest.raises(ValidationError):
        index_validator.validate(_invalid_index(populated_index, mutation))


def test_all_contribution_variants_and_cross_schema_reference_are_valid(
    details_validator,
    repository_details,
):
    details_validator.validate(repository_details)


def _invalid_details(repository_details, mutation):
    invalid = copy.deepcopy(repository_details)
    mutation(invalid)
    return invalid


@pytest.mark.parametrize(
    'mutation',
    [
        lambda data: data.update(schema_version=2),
        lambda data: data.pop('owner'),
        lambda data: data.update(unexpected=True),
        lambda data: data.update(key='missing-slash'),
        lambda data: data['contributions'][0].update(
            created='not-a-date-time'
        ),
        lambda data: data['contributions'][0].update(url='not-a-uri'),
        lambda data: data['contributions'][0].update(unexpected=True),
    ],
)
def test_invalid_repository_details_are_rejected(
    details_validator,
    repository_details,
    mutation,
):
    with pytest.raises(ValidationError):
        details_validator.validate(
            _invalid_details(repository_details, mutation)
        )


def test_empty_repository_details_are_valid(details_validator):
    details_validator.validate(
        {
            'schema_version': 1,
            'key': 'ExampleOrg/example-repo',
            'owner': 'ExampleOrg',
            'name': 'example-repo',
            'contributions': [],
        }
    )
