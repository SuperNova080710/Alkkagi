#!/usr/bin/env bash
# SECURITY BOUNDARY:
# Run this script from a checkout of the trusted default branch (main).
# NEVER source or execute a validator from the unverified target SHA.
set -euo pipefail

if [[ "${GITHUB_EVENT_NAME:-}" != "workflow_dispatch" ]]; then
  echo "::error::Trusted release validator is for manual workflow_dispatch only"
  exit 1
fi

selected_ref="${RELEASE_REF:-}"
if [[ "$selected_ref" != "develop" &&
      ! "$selected_ref" =~ ^release/v[0-9]+\.[0-9]+\.[0-9]+([.-][A-Za-z0-9.-]+)?$ ]]; then
  echo "::error::Manual validation requires develop or release/vX.Y.Z ref"
  exit 1
fi

# An omitted target_sha means the exact commit captured by GitHub when the
# dispatch was created. Never resolve a moving branch HEAD after validation.
sha="${RELEASE_TARGET_SHA:-${RELEASE_EVENT_SHA:-}}"
if [[ ! "$sha" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "::error::target_sha must be an exact 40-character Git commit SHA"
  exit 1
fi
sha="${sha,,}"

# The trusted checkout has its own git database. Fetch ONLY the selected
# ref; do not fetch the unvalidated SHA and do not run any target scripts.
ref="refs/remotes/origin/$selected_ref"
git fetch --quiet --no-tags origin \
  "+refs/heads/$selected_ref:$ref"
if ! git show-ref --verify --quiet "$ref"; then
  echo "::error::Selected ref was not fetched"
  exit 1
fi

if ! git cat-file -e "${sha}^{commit}" 2>/dev/null ||
   ! git merge-base --is-ancestor "$sha" "$ref"; then
  echo "::error::Requested commit is not reachable from the selected trusted ref"
  exit 1
fi

# GitHub's event SHA must also belong to the selected ref. Prevent a dispatch
# on an unrelated branch from passing by supplying a known develop SHA.
if [[ ! "${RELEASE_EVENT_SHA:-}" =~ ^[0-9a-fA-F]{40}$ ]] ||
   ! git merge-base --is-ancestor "${RELEASE_EVENT_SHA,,}" "$ref"; then
  echo "::error::Dispatch commit is not reachable from the selected trusted ref"
  exit 1
fi

if [[ -z "${GITHUB_OUTPUT:-}" ]]; then
  echo "::error::GITHUB_OUTPUT required for checked-out commit binding"
  exit 1
fi
printf 'target_sha=%s\n' "$sha" >> "$GITHUB_OUTPUT"
echo "PASS: trusted policy approved an ancestor of $selected_ref"
