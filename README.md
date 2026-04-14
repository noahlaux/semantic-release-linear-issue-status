# semantic-release-linear-issue-status

[![Test](https://github.com/noahlaux/semantic-release-linear-issue-status/actions/workflows/test.yml/badge.svg)](https://github.com/noahlaux/semantic-release-linear-issue-status/actions/workflows/test.yml)
[![Release](https://github.com/noahlaux/semantic-release-linear-issue-status/actions/workflows/release.yml/badge.svg)](https://github.com/noahlaux/semantic-release-linear-issue-status/actions/workflows/release.yml)
[![npm](https://img.shields.io/npm/v/semantic-release-linear-issue-status)](https://www.npmjs.com/package/semantic-release-linear-issue-status)
[![semantic-release](https://img.shields.io/badge/semantic--release-conventionalcommits-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

[**semantic-release**](https://github.com/semantic-release/semantic-release) plugin that moves **Linear** issues to a **completed** workflow state (by default the state named **Done**) after a **successful** release.

It scans the commits included in the release for issue identifiers such as `NEU-123` (configurable prefixes), then uses the [Linear SDK](https://github.com/linear/linear/tree/master/packages/sdk) to update each issue. Issues that are already **completed** or **canceled** are skipped.

## Requirements

- **Node.js** 18+
- **semantic-release** 21+
- A Linear **personal API key** ([Security & access](https://linear.app/settings/account/security))

## Install

```bash
npm install semantic-release-linear-issue-status --save-dev
```

## Usage

Add the plugin to your semantic-release configuration (after publish steps that must succeed first, if order matters for your setup):

```js
// release.config.js
module.exports = {
  plugins: [
    // ... analyze, release notes, publish, etc.
    [
      'semantic-release-linear-issue-status',
      {
        teamKey: 'NEU',
        issuePrefixes: ['NEU'],
      },
    ],
  ],
};
```

Set the API key in the environment where semantic-release runs (for example GitHub Actions secrets):

```bash
export LINEAR_API_KEY="lin_api_..."
```

### Options

| Option           | Required | Default            | Description |
|------------------|----------|--------------------|-------------|
| `teamKey`        | **yes**  | —                  | Linear team key (the part before `-` in `NEU-123`). |
| `issuePrefixes`  | **yes**  | —                  | Array of prefixes to detect in commit text (e.g. `['NEU', 'ENG']`). |
| `apiKeyEnvVar`   | no       | `LINEAR_API_KEY`   | Name of the environment variable holding the API key. |
| `apiUrl`         | no       | `https://api.linear.app/graphql` | Override for the Linear API endpoint. |
| `doneStateName`  | no       | `Done`             | Preferred **completed** workflow state name (case-insensitive). If no match, the first **completed** state (by `position`, then name) is used. |

### Steps

| Step | Description |
|------|-------------|
| `verifyConditions` | Verifies that `teamKey`, `issuePrefixes`, and the Linear API key environment variable are all present. Throws an error and aborts the release if any are missing. |
| `success` | Scans release commits for issue identifiers, then moves each unresolved issue to the target completed workflow state. |

### Behavior

- `verifyConditions` runs early in the semantic-release lifecycle and **fails fast** if configuration is incomplete, before any publish steps run.
- `success` no-ops when semantic-release is run with **`--dry-run`**.
- Issues already in a **completed** or **canceled** state are skipped.
- Per-issue errors are logged but do **not** fail the overall release.

### Commit scanning

Issue IDs are parsed from each release commit’s `message`, `subject`, and `body` fields using word-boundary patterns: `\bPREFIX-\d+\b`.

## Programmatic helpers

The package also exports pure helpers if you need them elsewhere:

```js
const {
  extractLinearIssueIdentifiers,
  extractLinearIssueIdentifiersFromCommits,
} = require('semantic-release-linear-issue-status');
```

## License

MIT
