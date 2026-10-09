#!/usr/bin/env bash
# Build the binary kinoko with the version of the build.
#
# Usage: backend/build.sh [output]. The default output is backend/kinoko.
# The version is KINOKO_VERSION, else "git describe", as in
# frontend/tools/stamp-version.mjs. Thus the app and the service show the same
# version. cgo needs LightGBM, netCDF, GDAL and PROJ. "nix develop .#backend"
# has them; on a different host, install the development packages.
set -euo pipefail
output=$(realpath -m "${1:-$(dirname "$0")/kinoko}")
cd "$(dirname "$0")"
version=${KINOKO_VERSION:-$(git describe --tags --always 2>/dev/null || echo dev)}
CGO_ENABLED=1 go build -trimpath \
  -ldflags "-X github.com/frederikbeimgraben/kinoko/backend/internal/core/config.build=$version" \
  -o "$output" ./cmd/kinoko
echo "built $output, version $version"
