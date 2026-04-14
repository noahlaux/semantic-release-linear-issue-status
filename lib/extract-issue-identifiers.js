/** Escapes special characters for use in a regular expression. */
function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns unique issue identifiers (e.g. NEU-123) found in plain text.
 *
 * @param {string} text
 * @param {string[]} issuePrefixes
 * @returns {string[]}
 */
function extractLinearIssueIdentifiers(text, issuePrefixes) {
  if (!text || typeof text !== 'string' || !issuePrefixes?.length) {
    return [];
  }
  const keys = issuePrefixes.map(escapeForRegex).join('|');
  const re = new RegExp(`\\b(${keys})-(\\d+)\\b`, 'g');
  const found = new Set();
  for (const match of text.matchAll(re)) {
    found.add(`${match[1]}-${match[2]}`);
  }
  return [...found].sort();
}

/**
 * Collects unique identifiers from semantic-release commit objects.
 *
 * Only `message` and `subject` are scanned. The `body` is intentionally
 * excluded — authors often reference unrelated issues there for context,
 * and we don't want to move those to completed.
 *
 * @param {Array<{ message?: string, subject?: string }>} commits
 * @param {string[]} issuePrefixes
 * @returns {string[]}
 */
function extractLinearIssueIdentifiersFromCommits(commits, issuePrefixes) {
  const ids = new Set();
  for (const c of commits || []) {
    const text = [c.message, c.subject].filter(Boolean).join('\n');
    for (const id of extractLinearIssueIdentifiers(text, issuePrefixes)) {
      ids.add(id);
    }
  }
  return [...ids].sort();
}

module.exports = {
  extractLinearIssueIdentifiers,
  extractLinearIssueIdentifiersFromCommits,
};
