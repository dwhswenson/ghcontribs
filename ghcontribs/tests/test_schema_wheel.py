import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).parents[2]
SCHEMA_FILENAMES = (
    'contributions.schema.json',
    'repository-details.schema.json',
    'visualization-index.schema.json',
)


def test_wheel_schemas_are_runtime_resources(tmp_path):
    project = tmp_path / 'project'
    project.mkdir()
    for filename in ('LICENSE', 'README.md', 'setup.cfg', 'setup.py'):
        shutil.copy2(PROJECT_ROOT / filename, project / filename)

    setup_config = project / 'setup.cfg'
    setup_config.write_text(
        setup_config.read_text().replace(
            'version = 0.1.0.dev0\n',
            'version = 0.1.0.dev1\n',
            1,
        )
    )

    package = project / 'ghcontribs'
    package.mkdir()
    for source in (PROJECT_ROOT / 'ghcontribs').glob('*.py'):
        shutil.copy2(source, package / source.name)
    shutil.copytree(PROJECT_ROOT / 'schemas', project / 'schemas')

    wheels = tmp_path / 'wheels'
    result = subprocess.run(
        [
            sys.executable,
            'setup.py',
            'bdist_wheel',
            '--dist-dir',
            str(wheels),
        ],
        cwd=project,
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr

    installed = tmp_path / 'installed'
    with zipfile.ZipFile(next(wheels.glob('*.whl'))) as wheel:
        wheel.extractall(installed)

    code = (
        'import json; '
        'from importlib.resources import files; '
        'root = files("ghcontribs._schemas.v1"); '
        f'names = {SCHEMA_FILENAMES!r}; '
        '[json.loads(root.joinpath(name).read_text()) for name in names]'
    )
    environment = os.environ.copy()
    environment['PYTHONPATH'] = str(installed)
    result = subprocess.run(
        [sys.executable, '-c', code],
        cwd=tmp_path,
        check=False,
        capture_output=True,
        text=True,
        env=environment,
    )
    assert result.returncode == 0, result.stderr
