#!/usr/bin/env bash
# Vercel's "ignoreCommand" gate (see vercel.json): exit 1 means "go
# ahead and deploy", exit 0 means "skip this deployment" - inverted
# from normal shell convention, per Vercel's own docs. This is the only
# thing standing between a genuine JS syntax error in a serverless
# function (api/**/*.js) or a shared assets/js/*.js file and it going
# live with no warning at all, since this is a static site with no
# build step to ever catch it otherwise - the mistake would only
# surface the moment a real visitor's request actually hits that code.
set -uo pipefail

while IFS= read -r -d '' file; do
  if ! node --check "$file" > /dev/null 2>&1; then
    echo "Syntax error in $file - skipping this deploy, previous version stays live."
    exit 0
  fi
done < <(find . -name "*.js" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./scripts/backup/node_modules/*" -print0)

if ! node -e "JSON.parse(require('fs').readFileSync('vercel.json', 'utf8'))" > /dev/null 2>&1; then
  echo "vercel.json is not valid JSON - skipping this deploy, previous version stays live."
  exit 0
fi

echo "All checks passed - proceeding with deploy."
exit 1
