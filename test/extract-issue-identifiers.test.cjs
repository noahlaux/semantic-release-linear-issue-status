const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractLinearIssueIdentifiers,
  extractLinearIssueIdentifiersFromCommits,
} = require('../lib/extract-issue-identifiers.js');

describe('extractLinearIssueIdentifiers', () => {
  const neuOnly = ['NEU'];

  it('extracts unique sorted identifiers', () => {
    assert.deepEqual(extractLinearIssueIdentifiers('feat: NEU-2 fix NEU-1 and NEU-2', neuOnly), [
      'NEU-1',
      'NEU-2',
    ]);
  });

  it('returns empty for missing input or prefixes', () => {
    assert.deepEqual(extractLinearIssueIdentifiers('NEU-1', []), []);
    assert.deepEqual(extractLinearIssueIdentifiers('NEU-1', null), []);
    assert.deepEqual(extractLinearIssueIdentifiers('', neuOnly), []);
  });
});

describe('extractLinearIssueIdentifiersFromCommits', () => {
  it('extracts from message and subject', () => {
    const ids = extractLinearIssueIdentifiersFromCommits(
      [{ subject: 'fix: NEU-10' }, { message: 'chore: NEU-12\n\nNEU-10 duplicate' }],
      ['NEU']
    );
    assert.deepEqual(ids, ['NEU-10', 'NEU-12']);
  });

  it('does not scan body to avoid false positives from context references', () => {
    const ids = extractLinearIssueIdentifiersFromCommits(
      [{ subject: 'fix: NEU-10', body: 'Related to NEU-99, see also NEU-100' }],
      ['NEU']
    );
    assert.deepEqual(ids, ['NEU-10']);
  });

  it('handles empty commits', () => {
    assert.deepEqual(extractLinearIssueIdentifiersFromCommits(undefined, ['NEU']), []);
  });
});
