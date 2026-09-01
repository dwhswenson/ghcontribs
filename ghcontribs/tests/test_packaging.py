import os
import shutil
import subprocess
import sys
import sysconfig
import tarfile
import zipfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).parents[2]
SCHEMAS = {
    'contributions.schema.json',
    'repository-details.schema.json',
    'visualization-index.schema.json',
}


def _copy_packaging_source(destination):
    destination.mkdir()
    for filename in (
        'LICENSE',
        'MANIFEST.in',
        'README.md',
        'setup.cfg',
        'setup.py',
    ):
        shutil.copy2(PROJECT_ROOT / filename, destination / filename)
    setup_config = destination / 'setup.cfg'
    setup_config.write_text(
        setup_config.read_text().replace(
            'version = 0.1.0.dev0\n',
            'version = 0.1.0.dev1\n',
            1,
        )
    )

    package = destination / 'ghcontribs'
    package.mkdir()
    for source in (PROJECT_ROOT / 'ghcontribs').glob('*.py'):
        shutil.copy2(source, package / source.name)

    tests = package / 'tests'
    tests.mkdir()
    (tests / '__init__.py').write_text('')
    (tests / 'authorization.py').write_text("TOKEN = 'must-not-ship'\n")
    (tests / 'test_sample.py').write_text('def test_sample(): pass\n')
    shutil.copytree(PROJECT_ROOT / 'schemas', destination / 'schemas')


def _run(command, cwd, *, env=None):
    result = subprocess.run(
        command,
        cwd=cwd,
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )
    assert result.returncode == 0, result.stderr
    return result


def test_sdist_wheel_and_editable_install_include_schema_resources(tmp_path):
    project = tmp_path / 'project'
    _copy_packaging_source(project)
    distributions = tmp_path / 'distributions'
    distributions.mkdir()

    _run(
        [sys.executable, 'setup.py', 'sdist', '--dist-dir', str(distributions)],
        project,
    )
    sdist = next(distributions.glob('*.tar.gz'))
    with tarfile.open(sdist) as archive:
        names = set(archive.getnames())
        root = next(iter(names)).split('/', 1)[0]
        assert {
            f'{root}/schemas/v1/{filename}' for filename in SCHEMAS
        } <= names
        assert f'{root}/ghcontribs/tests/authorization.py' not in names

    unpacked = tmp_path / 'unpacked'
    with tarfile.open(sdist) as archive:
        archive.extractall(unpacked)
    sdist_project = next(unpacked.iterdir())
    wheels = tmp_path / 'wheels'
    wheels.mkdir()
    _run(
        [
            sys.executable,
            'setup.py',
            'bdist_wheel',
            '--dist-dir',
            str(wheels),
        ],
        sdist_project,
    )
    wheel = next(wheels.glob('*.whl'))
    with zipfile.ZipFile(wheel) as archive:
        names = set(archive.namelist())
        assert {
            f'ghcontribs/_schemas/v1/{filename}' for filename in SCHEMAS
        } <= names
        assert not any('authorization.py' in name for name in names)

    installed = tmp_path / 'installed'
    with zipfile.ZipFile(wheel) as archive:
        archive.extractall(installed)
    code = (
        'from ghcontribs.schema_utils import load_schemas; '
        'assert len(load_schemas()) == 3'
    )
    environment = os.environ.copy()
    environment['PYTHONPATH'] = str(installed)
    _run([sys.executable, '-c', code], tmp_path, env=environment)

    editable_wheels = tmp_path / 'editable-wheels'
    editable_wheels.mkdir()
    build_editable = (
        'from setuptools.build_meta import build_editable; '
        f'build_editable({str(editable_wheels)!r})'
    )
    _run([sys.executable, '-c', build_editable], project)
    editable_site = tmp_path / 'editable-site'
    editable_site.mkdir()
    editable_wheel = next(editable_wheels.glob('*.whl'))
    with zipfile.ZipFile(editable_wheel) as archive:
        archive.extractall(editable_site)
    editable_code = (
        'import sys, site; '
        f'sys.path.append({sysconfig.get_path("purelib")!r}); '
        f'site.addsitedir({str(editable_site)!r}); '
        'from ghcontribs.schema_utils import load_schemas; '
        'assert len(load_schemas()) == 3'
    )
    _run([sys.executable, '-S', '-c', editable_code], tmp_path)
