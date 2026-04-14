const { extractLinearIssueIdentifiersFromCommits } = require('./extract-issue-identifiers');
const {
  createLinearClient,
  fetchTeamStates,
  fetchIssue,
  updateIssueState,
  pickDoneWorkflowStateId,
} = require('./linear-api');

const LOG_PREFIX = '[semantic-release-linear-issue-status]';

/**
 * @typedef {object} PluginConfig
 * @property {string} teamKey - Linear team key (e.g. NEU in NEU-123).
 * @property {string[]} issuePrefixes - Prefixes to scan for (e.g. ['NEU', 'ENG']).
 * @property {string} [apiKeyEnvVar=LINEAR_API_KEY] - Env var holding the Linear API key.
 * @property {string} [apiUrl] - Override Linear API URL (default api.linear.app).
 * @property {string} [doneStateName=Done] - Preferred completed state name (case-insensitive).
 */

/**
 * semantic-release verifyConditions: validate config and Linear API key.
 *
 * @param {PluginConfig} pluginConfig
 * @param {*} context
 */
async function verifyConditions(pluginConfig, context) {
  const { logger } = context;
  const errors = [];

  const teamKey = pluginConfig?.teamKey;
  const issuePrefixes = pluginConfig?.issuePrefixes;
  const apiKeyEnvVar = pluginConfig?.apiKeyEnvVar || 'LINEAR_API_KEY';

  if (!teamKey) {
    errors.push('Missing required option "teamKey".');
  }

  if (!issuePrefixes?.length) {
    errors.push('Missing required option "issuePrefixes" (must be a non-empty array).');
  }

  const apiKey = process.env[apiKeyEnvVar];
  if (!apiKey) {
    errors.push(`Environment variable "${apiKeyEnvVar}" is not set. A Linear API key is required.`);
  }

  if (errors.length) {
    for (const msg of errors) {
      logger.error(`${LOG_PREFIX} ${msg}`);
    }
    throw new Error(
      `${LOG_PREFIX} Configuration errors:\n${errors.map((m) => `  - ${m}`).join('\n')}`
    );
  }

  logger.log(`${LOG_PREFIX} Verified: teamKey="${teamKey}", apiKeyEnvVar="${apiKeyEnvVar}".`);
}

/**
 * semantic-release success: move linked Linear issues to Done (completed workflow state).
 *
 * @param {PluginConfig} pluginConfig
 * @param {*} context
 */
async function success(pluginConfig, context) {
  const { logger, commits, options = {} } = context;
  const teamKey = pluginConfig?.teamKey;
  const issuePrefixes = pluginConfig?.issuePrefixes;
  const apiKeyEnvVar = pluginConfig?.apiKeyEnvVar || 'LINEAR_API_KEY';
  const apiUrl = pluginConfig?.apiUrl;
  const doneStateName = (pluginConfig?.doneStateName || 'Done').trim().toLowerCase();

  if (options.dryRun) {
    logger.log(`${LOG_PREFIX} Dry run: skipping Linear updates.`);
    return;
  }

  const apiKey = process.env[apiKeyEnvVar];

  const identifiers = extractLinearIssueIdentifiersFromCommits(commits, issuePrefixes);
  if (!identifiers.length) {
    logger.log(`${LOG_PREFIX} No issue identifiers in release commits; nothing to update.`);
    return;
  }

  const client = createLinearClient(apiKey, apiUrl);

  let doneStateId;
  try {
    const stateNodes = await fetchTeamStates(client, teamKey);
    if (!stateNodes) {
      logger.error(`${LOG_PREFIX} Team with key "${teamKey}" not found.`);
      return;
    }
    doneStateId = pickDoneWorkflowStateId(stateNodes, doneStateName);
    if (!doneStateId) {
      logger.error(`${LOG_PREFIX} No completed workflow state for team "${teamKey}".`);
      return;
    }
  } catch (e) {
    logger.error(`${LOG_PREFIX} Failed to resolve target state: ${e.message}`);
    return;
  }

  logger.log(`${LOG_PREFIX} Updating ${identifiers.length} issue(s): ${identifiers.join(', ')}`);

  for (const id of identifiers) {
    try {
      const issue = await fetchIssue(client, id);
      if (!issue) {
        logger.warn(`${LOG_PREFIX} Issue ${id} not found; skipping.`);
        continue;
      }
      const state = await issue.state;
      const stateType = state?.type;
      if (stateType === 'completed') {
        logger.log(`${LOG_PREFIX} ${issue.identifier} already completed; skipping.`);
        continue;
      }
      if (stateType === 'canceled') {
        logger.log(`${LOG_PREFIX} ${issue.identifier} is canceled; skipping.`);
        continue;
      }
      const payload = await updateIssueState(issue, doneStateId);
      if (payload.success) {
        const updatedIssue = await payload.issue;
        const updatedState = await updatedIssue?.state;
        logger.log(
          `${LOG_PREFIX} ${updatedIssue?.identifier || id} → ${updatedState?.name || 'Done'}`
        );
      } else {
        logger.warn(`${LOG_PREFIX} issueUpdate did not succeed for ${id}.`);
      }
    } catch (e) {
      logger.error(`${LOG_PREFIX} Failed to update ${id}: ${e.message}`);
    }
  }
}

const extractIssueIdentifiers = require('./extract-issue-identifiers');

module.exports = {
  verifyConditions,
  success,
  ...extractIssueIdentifiers,
};
