#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "${script_dir}/.." && pwd)"
repository_dir="$(cd "${project_dir}/.." && pwd)"
snapshot_uid="$(id -u)"
snapshot_gid="$(id -g)"
playwright_version="$(
  node -e \
    'const lock = require(process.argv[1]); process.stdout.write(lock.packages["node_modules/@playwright/test"].version)' \
    "${project_dir}/package-lock.json"
)"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run the Linux browser tests." >&2
  exit 1
fi

case "${1:-}" in
  "") npm_script="test:browser" ;;
  --update) npm_script="test:browser:update:current" ;;
  *)
    echo "Usage: $0 [--update]" >&2
    exit 2
    ;;
esac

docker run --rm --ipc=host \
  --env HOME=/tmp \
  --env PLAYWRIGHT_NPM_SCRIPT="${npm_script}" \
  --env SNAPSHOT_UID="${snapshot_uid}" \
  --env SNAPSHOT_GID="${snapshot_gid}" \
  --volume "${repository_dir}:/work" \
  --volume /work/ghcontribs-viz/node_modules \
  --workdir /work/ghcontribs-viz \
  "mcr.microsoft.com/playwright:v${playwright_version}-noble" \
  bash -lc '
    status=0
    npm ci && npm run "${PLAYWRIGHT_NPM_SCRIPT}" || status=$?
    find e2e -path "*-snapshots/*.png" -exec chown "${SNAPSHOT_UID}:${SNAPSHOT_GID}" {} +
    if [[ -d test-results ]]; then chown -R "${SNAPSHOT_UID}:${SNAPSHOT_GID}" test-results; fi
    exit "${status}"
  '
