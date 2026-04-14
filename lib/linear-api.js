const { LinearClient } = require('@linear/sdk');

/**
 * @param {string} apiKey
 * @param {string} [apiUrl] - Override Linear API URL.
 * @returns {LinearClient}
 */
function createLinearClient(apiKey, apiUrl) {
  const opts = { apiKey };
  if (apiUrl) {
    opts.apiUrl = apiUrl;
  }
  return new LinearClient(opts);
}

/**
 * Resolves the Linear team matching `teamKey` and returns its workflow state
 * nodes, or null if the team is not found.
 *
 * @param {LinearClient} client
 * @param {string} teamKey
 * @returns {Promise<Array<{ id: string, name: string, type: string, position: number }> | null>}
 */
async function fetchTeamStates(client, teamKey) {
  const teams = await client.teams({ filter: { key: { eq: teamKey } } });
  const team = teams.nodes[0];
  if (!team) {
    return null;
  }
  const states = await team.states();
  return states.nodes;
}

/**
 * Fetches a single issue by its identifier (e.g. "NEU-123").
 * Returns null when the issue does not exist.
 *
 * @param {LinearClient} client
 * @param {string} identifier
 * @returns {Promise<import('@linear/sdk').Issue | null>}
 */
async function fetchIssue(client, identifier) {
  try {
    return await client.issue(identifier);
  } catch {
    return null;
  }
}

/**
 * Moves an issue to the given workflow state.
 * Returns the IssueUpdatePayload from the SDK.
 *
 * @param {import('@linear/sdk').Issue} issue
 * @param {string} stateId
 */
async function updateIssueState(issue, stateId) {
  return issue.update({ stateId });
}

/**
 * @param {Array<{ id: string, name: string, type: string, position?: number }>} nodes
 * @param {string} [preferredDoneName] normalized lower-case name, default "done"
 * @returns {string | null}
 */
function pickDoneWorkflowStateId(nodes, preferredDoneName = 'done') {
  const completed = (nodes || []).filter((s) => s.type === 'completed');
  if (!completed.length) {
    return null;
  }
  const namedDone = completed.find(
    (s) => s.name && s.name.trim().toLowerCase() === preferredDoneName
  );
  if (namedDone) {
    return namedDone.id;
  }
  const sorted = [...completed].sort((a, b) => {
    const pa = a.position ?? 0;
    const pb = b.position ?? 0;
    if (pa !== pb) return pa - pb;
    return (a.name || '').localeCompare(b.name || '');
  });
  return sorted[0].id;
}

module.exports = {
  createLinearClient,
  fetchTeamStates,
  fetchIssue,
  updateIssueState,
  pickDoneWorkflowStateId,
};
