#!/usr/bin/env bash
set -euo pipefail

VERSION="${1}"

# Temporarily rename the package to the scoped name required by GitHub Packages,
# publish, then restore the original name.
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.name = '@noahlaux/semantic-release-linear-issue-status';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

npm publish --registry https://npm.pkg.github.com --access public

node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.name = 'semantic-release-linear-issue-status';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

echo "Published @noahlaux/semantic-release-linear-issue-status@${VERSION} to GitHub Packages"
