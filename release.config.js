module.exports = {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],
    // Publish to the public npm registry
    '@semantic-release/npm',
    // Publish to GitHub Packages under the scoped name @noahlaux/...
    [
      '@semantic-release/exec',
      {
        publishCmd: 'scripts/publish-github-packages.sh ${nextRelease.version}',
      },
    ],
    '@semantic-release/github',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
};
