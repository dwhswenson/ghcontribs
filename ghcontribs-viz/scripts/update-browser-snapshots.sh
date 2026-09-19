#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "${script_dir}/.." && pwd)"

cd "${project_dir}"
if [[ "$(uname -s)" == "Darwin" ]]; then
  npm run test:browser:update:current
fi

"${script_dir}/run-browser-tests-linux.sh" --update
