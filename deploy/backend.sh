#!/usr/bin/env bash
# Copy the Go service to the work directory of a homeserver without the NixOS module.
#
# The service restarts when deploy.stamp changes. Thus the script writes the
# stamp in a second rsync call, after the binary is complete. A restart during
# the copy would start a part of a binary. The service migrates the database
# at start. docs/operations.md tells how to set up the host.
#
# Variables:
#   ZIEL        rsync target, user@host. The work directory is app/backend below its root.
#   SCHLUESSEL  SSH key of the target.
#   BAU         go (default): backend/build.sh. The binary uses the C libraries
#               of the build host, thus build on a host with the same system.
#               nix: nix build .#backend. The binary uses the Nix store, thus
#               the script copies the closure to NIX_ZIEL (user@host with Nix).
set -euo pipefail
cd "$(dirname "$0")/.."
ZIEL=${ZIEL:-pilzedeploy@10.66.66.6}
SCHLUESSEL=${SCHLUESSEL:-$HOME/.ssh/pilze_daten}
BAU=${BAU:-go}
SSH="ssh -i $SCHLUESSEL -o IdentitiesOnly=yes"

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/app/backend"

case "$BAU" in
  go)
    backend/build.sh "$STAGE/app/backend/kinoko"
    ;;
  nix)
    [ -n "${NIX_ZIEL:-}" ] || { echo "BAU=nix needs NIX_ZIEL (user@host with Nix) for the closure"; exit 1; }
    nix build .#backend --out-link "$STAGE/result"
    nix copy --to "ssh://$NIX_ZIEL" "$(readlink -f "$STAGE/result")"
    cp "$STAGE/result/bin/kinoko" "$STAGE/app/backend/kinoko"
    chmod u+w "$STAGE/app/backend/kinoko"
    ;;
  *)
    echo "BAU must be go or nix, not $BAU"
    exit 1
    ;;
esac
"$STAGE/app/backend/kinoko" version

# rsync does not make parent folders. The first call makes app/ on a new host.
echo "copy the service to $ZIEL:app/backend"
rsync -a -e "$SSH" --exclude 'backend/*' "$STAGE/app" "$ZIEL":
# --delete removes old files. The settings, the local data and the stamp stay.
rsync -a --delete --info=stats2 \
  --exclude '.env' --exclude 'var/' --exclude 'deploy.stamp' \
  -e "$SSH" "$STAGE/app/backend/" "$ZIEL":app/backend/
date -u +%Y-%m-%dT%H:%M:%SZ > "$STAGE/deploy.stamp"
rsync -a -e "$SSH" "$STAGE/deploy.stamp" "$ZIEL":app/backend/deploy.stamp
echo "done, the service restarts"
