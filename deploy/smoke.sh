#!/usr/bin/env bash
# Checks a deployed instance from the outside.
#
#   deploy/smoke.sh https://kinoko.reutlingen.university
#
# The checks:
#   - GET /api/health gives {"status": "ok"}.
#   - GET /api/config has oidcIssuer, oidcName and a version in the date-tag form.
#   - /layers.json is JSON.
#   - The manifest /<slug>.json of each species with forecastEnabled is JSON.
#     The script reads the species from /api/species, page by page.
#
# A manifest must come as JSON with status 200. The app page (text/html with
# status 200) is a failure: it shows a rewrite rule that sends index.html for
# a missing file. docs/operations.md, section "Caddy", gives the correct rules.
#
# Exit code: 0 when all checks pass, 1 when a check fails, 2 for a usage error.
# Tools: bash, curl, jq.
set -uo pipefail

usage() {
  echo "usage: $0 <base url>    for example: $0 https://kinoko.reutlingen.university" >&2
  exit 2
}

[ $# -eq 1 ] || usage
BASE=${1%/}
case $BASE in
  http://* | https://*) ;;
  *) usage ;;
esac
for tool in curl jq; do
  command -v "$tool" >/dev/null || {
    echo "missing tool: $tool" >&2
    exit 2
  }
done

# A release tag vYYYY-MM-DD-NN, optional with the commit count of "git describe"
# (v2026-10-08-01-3), or the Nix form with date and commit (v2026-10-09+65dd41a).
VERSION_FORM='^v[0-9]{4}-[0-9]{2}-[0-9]{2}(-[0-9]{2})?(-[0-9]+)?(\+[0-9a-f]{7,})?$'
# The service gives at most 40 species on a page. The limit stops a cursor loop.
PAGE_LIMIT=100

FAILED=0
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
BODY="$WORK/body"

pass() { printf 'ok    %s\n' "$1"; }
warn() { printf 'warn  %s: %s\n' "$1" "$2"; }
fail() {
  printf 'FAIL  %s: %s\n' "$1" "$2"
  FAILED=$((FAILED + 1))
}

# get NAME URL: loads URL into $BODY. It passes when the reply has status 200,
# the content type application/json and a JSON object or array as body.
get() {
  local name=$1 url=$2 reply status type
  if ! reply=$(curl -sS --max-time 30 -o "$BODY" -w '%{http_code} %{content_type}' "$url" 2>"$WORK/error"); then
    fail "$name" "no reply from $url: $(head -c 200 "$WORK/error")"
    return 1
  fi
  status=${reply%% *}
  type=${reply#* }
  if [ "$status" != 200 ]; then
    fail "$name" "status $status from $url"
    return 1
  fi
  case $type in
    application/json*) ;;
    text/html*)
      fail "$name" "$url gives the app page (text/html), not JSON. Is the file missing and the path rewritten to /index.html?"
      return 1
      ;;
    *)
      fail "$name" "content type '$type' from $url, not application/json"
      return 1
      ;;
  esac
  if ! jq -e 'type == "object" or type == "array"' "$BODY" >/dev/null 2>&1; then
    fail "$name" "the body of $url is not a JSON object or array"
    return 1
  fi
}

# field PATH: the string at the jq PATH in $BODY, or empty.
field() { jq -r "$1 // \"\" | strings" "$BODY"; }

echo "Checks of $BASE"

# 1. Health.
if get "health" "$BASE/api/health"; then
  status=$(field '.status')
  if [ "$status" = ok ]; then pass "health"; else fail "health" "status is '$status', not 'ok'"; fi
fi

# 2. Config. The origin of the maps is in the config. Empty means the base URL.
ORIGIN=$BASE
if get "config" "$BASE/api/config"; then
  issuer=$(field '.oidcIssuer')
  name=$(field '.oidcName')
  version=$(field '.version')
  origin=$(field '.origin')
  [ -n "$origin" ] && ORIGIN=${origin%/}
  ok=1
  if [ -z "$issuer" ]; then
    fail "config" "oidcIssuer is empty: the service has no SSO"
    ok=0
  fi
  if [ -z "$name" ]; then
    fail "config" "oidcName is empty"
    ok=0
  elif [ -n "$issuer" ] && [[ $issuer == *"://$name"* ]]; then
    warn "config" "oidcName is the host of the issuer ($name). Set oidc.name for the sign-in button"
  fi
  if ! [[ $version =~ $VERSION_FORM ]]; then
    fail "config" "version '$version' is not in the date-tag form (for example v2026-10-08-01)"
    ok=0
  fi
  [ "$ok" = 1 ] && pass "config: version $version, SSO '$name'"
fi

# 3. Layers manifest.
get "layers.json" "$ORIGIN/layers.json" && pass "layers.json: $(jq '.layers | length' "$BODY") layers"

# 4. The manifest of each species with a forecast.
slugs="$WORK/slugs"
: >"$slugs"
cursor=""
pages=0
listed=1
while :; do
  url="$BASE/api/species?limit=40"
  [ -n "$cursor" ] && url="$url&cursor=$(jq -rn --arg c "$cursor" '$c | @uri')"
  if ! get "species list" "$url"; then
    listed=0
    break
  fi
  jq -r '.items[] | select(.forecastEnabled == true) | .slug' "$BODY" >>"$slugs"
  cursor=$(field '.nextCursor')
  pages=$((pages + 1))
  [ -z "$cursor" ] && break
  if [ "$pages" -ge "$PAGE_LIMIT" ]; then
    fail "species list" "more than $PAGE_LIMIT pages, the cursor does not end"
    listed=0
    break
  fi
done

if [ "$listed" = 1 ]; then
  count=$(wc -l <"$slugs")
  if [ "$count" -eq 0 ]; then
    fail "species" "no species has forecastEnabled, so the map has no forecast"
  else
    pass "species: $count with forecast on $pages pages"
  fi
  while IFS= read -r slug; do
    get "manifest $slug" "$ORIGIN/$slug.json" && pass "manifest $slug: $(jq '.weeks | length' "$BODY") weeks"
  done <"$slugs"
fi

echo
if [ "$FAILED" -gt 0 ]; then
  echo "$FAILED checks failed."
  exit 1
fi
echo "All checks passed."
