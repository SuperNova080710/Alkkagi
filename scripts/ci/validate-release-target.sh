#!/usr/bin/env bash
# Reject manual dispatches that attempt to checkout an unrelated or invalid SHA.
# This script must run immediately after actions/checkout and before npm, Docker
# or any repository-controlled build/test script executes.
set -euo pipefail
if [[ "${GITHUB_EVENT_NAME:-}" != workflow_dispatch ]]; then
  echo "Release gate using event checkout (PR merge commit or push SHA)"
  exit 0
fi

sha="${RELEASE_TARGET_SHA:-}"
if [[ -z "$sha" ]]; then
  echo "Release gate using selected dispatch branch/tag HEAD"
  exit 0
fi

if [[ ! "$sha" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "::error::target_sha must be an exact 40-character Git commit SHA"
  exit 1
fi
sha="${sha,,}"
if [[ "$(git rev-parse --verify 'HEAD^{commit}')" != "$sha" ]]; then
  echo "::error::Checked out HEAD differs from requested target_sha"
  exit 1
fi

# Allow only commits reachable from develop or a release/v* branch. This
# avoids accidentally testing arbitrary external or unrelated references.
git fetch --quiet --no-tags origin \
  '+refs/heads/develop:refs/remotes/origin/develop' \
  '+refs/heads/release/v*:refs/remotes/origin/release/v*'
if git merge-base --is-ancestor "$sha" refs/remotes/origin/develop; then
  echo "PASS: manual SHA is reachable from develop"
  exit 0
fi
while IFS= read -r ref; do
  if git merge-base --is-ancestor "$sha" "$ref"; then
    echo "PASS: manual SHA is reachable from a release/v* branch"
    exit 0
  fi
done < <(git for-each-ref --format='%(refname)' refs/remotes/origin/release/v)
echo "::error::target_sha is not reachable from develop or a release/v* branch"
exit 1
