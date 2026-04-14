const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  const logs = [];
  return {
    log: (...a) => logs.push(['log', a.join(' ')]),
    warn: (...a) => logs.push(['warn', a.join(' ')]),
    error: (...a) => logs.push(['error', a.join(' ')]),
    entries: logs,
    has: (level, substr) => logs.some(([l, m]) => l === level && m.includes(substr)),
  };
}

function makeContext(overrides = {}) {
  return {
    logger: makeLogger(),
    commits: [],
    options: {},
    ...overrides,
  };
}

function makeConfig(overrides = {}) {
  return {
    teamKey: 'NEU',
    issuePrefixes: ['NEU'],
    ...overrides,
  };
}

// Mock the linear-api module so tests never hit the network
const linearApiMock = {
  createLinearClient: mock.fn(() => ({})),
  fetchTeamStates: mock.fn(async () => [
    { id: 'state-done', name: 'Done', type: 'completed', position: 1 },
  ]),
  fetchIssue: mock.fn(async () => ({
    identifier: 'NEU-1',
    state: Promise.resolve({ type: 'unstarted', name: 'Todo' }),
    update: async () => ({
      success: true,
      issue: Promise.resolve({
        identifier: 'NEU-1',
        state: Promise.resolve({ name: 'Done' }),
      }),
    }),
  })),
  updateIssueState: mock.fn(async (issue, stateId) => issue.update({ stateId })),
  pickDoneWorkflowStateId: mock.fn(() => 'state-done'),
};

// Patch require cache before loading index
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../lib/linear-api.js' || request === './linear-api') {
    return linearApiMock;
  }
  return originalLoad.apply(this, arguments);
};

const { verifyConditions, success } = require('../lib/index.js');

Module._load = originalLoad;

// ---------------------------------------------------------------------------
// verifyConditions
// ---------------------------------------------------------------------------

describe('verifyConditions', () => {
  beforeEach(() => {
    process.env.LINEAR_API_KEY = 'lin_api_test';
  });

  afterEach(() => {
    delete process.env.LINEAR_API_KEY;
    delete process.env.MY_LINEAR_KEY;
  });

  it('resolves without error when config and env are valid', async () => {
    const ctx = makeContext();
    await assert.doesNotReject(() => verifyConditions(makeConfig(), ctx));
    assert.ok(ctx.logger.has('log', 'Verified'));
  });

  it('throws when teamKey is missing', async () => {
    const ctx = makeContext();
    await assert.rejects(
      () => verifyConditions(makeConfig({ teamKey: undefined }), ctx),
      /teamKey/
    );
    assert.ok(ctx.logger.has('error', 'teamKey'));
  });

  it('throws when issuePrefixes is missing', async () => {
    const ctx = makeContext();
    await assert.rejects(
      () => verifyConditions(makeConfig({ issuePrefixes: [] }), ctx),
      /issuePrefixes/
    );
  });

  it('throws when API key env var is not set', async () => {
    delete process.env.LINEAR_API_KEY;
    const ctx = makeContext();
    await assert.rejects(() => verifyConditions(makeConfig(), ctx), /LINEAR_API_KEY/);
    assert.ok(ctx.logger.has('error', 'LINEAR_API_KEY'));
  });

  it('respects a custom apiKeyEnvVar', async () => {
    delete process.env.LINEAR_API_KEY;
    process.env.MY_LINEAR_KEY = 'lin_api_custom';
    const ctx = makeContext();
    await assert.doesNotReject(() =>
      verifyConditions(makeConfig({ apiKeyEnvVar: 'MY_LINEAR_KEY' }), ctx)
    );
  });

  it('throws and reports all errors at once', async () => {
    delete process.env.LINEAR_API_KEY;
    const ctx = makeContext();
    await assert.rejects(
      () => verifyConditions({ issuePrefixes: [] }, ctx),
      /Configuration errors/
    );
    // teamKey, issuePrefixes, and api key all missing
    assert.ok(ctx.logger.has('error', 'teamKey'));
    assert.ok(ctx.logger.has('error', 'issuePrefixes'));
    assert.ok(ctx.logger.has('error', 'LINEAR_API_KEY'));
  });
});

// ---------------------------------------------------------------------------
// success
// ---------------------------------------------------------------------------

describe('success', () => {
  beforeEach(() => {
    process.env.LINEAR_API_KEY = 'lin_api_test';
    linearApiMock.createLinearClient.mock.resetCalls();
    linearApiMock.fetchTeamStates.mock.resetCalls();
    linearApiMock.fetchIssue.mock.resetCalls();
    linearApiMock.pickDoneWorkflowStateId.mock.resetCalls();
  });

  afterEach(() => {
    delete process.env.LINEAR_API_KEY;
  });

  it('skips on dry run', async () => {
    const ctx = makeContext({ options: { dryRun: true } });
    await success(makeConfig(), ctx);
    assert.ok(ctx.logger.has('log', 'Dry run'));
    assert.equal(linearApiMock.createLinearClient.mock.calls.length, 0);
  });

  it('skips when no issue identifiers found in commits', async () => {
    const ctx = makeContext({ commits: [{ message: 'chore: housekeeping' }] });
    await success(makeConfig(), ctx);
    assert.ok(ctx.logger.has('log', 'No issue identifiers'));
  });

  it('logs error and returns when team not found', async () => {
    linearApiMock.fetchTeamStates.mock.mockImplementationOnce(async () => null);
    const ctx = makeContext({ commits: [{ message: 'fix: NEU-1 bug' }] });
    await success(makeConfig(), ctx);
    assert.ok(ctx.logger.has('error', 'not found'));
  });

  it('logs error and returns when no completed workflow state', async () => {
    linearApiMock.fetchTeamStates.mock.mockImplementationOnce(async () => [
      { id: 'x', name: 'Todo', type: 'unstarted', position: 0 },
    ]);
    linearApiMock.pickDoneWorkflowStateId.mock.mockImplementationOnce(() => null);
    const ctx = makeContext({ commits: [{ message: 'fix: NEU-1 bug' }] });
    await success(makeConfig(), ctx);
    assert.ok(ctx.logger.has('error', 'No completed workflow state'));
  });

  it('logs error and returns when fetchTeamStates throws', async () => {
    linearApiMock.fetchTeamStates.mock.mockImplementationOnce(async () => {
      throw new Error('network failure');
    });
    const ctx = makeContext({ commits: [{ message: 'fix: NEU-1 bug' }] });
    await success(makeConfig(), ctx);
    assert.ok(ctx.logger.has('error', 'network failure'));
  });

  it('skips issue when not found', async () => {
    linearApiMock.fetchIssue.mock.mockImplementationOnce(async () => null);
    const ctx = makeContext({ commits: [{ message: 'fix: NEU-1 bug' }] });
    await success(makeConfig(), ctx);
    assert.ok(ctx.logger.has('warn', 'not found'));
  });

  it('skips issue already completed', async () => {
    linearApiMock.fetchIssue.mock.mockImplementationOnce(async () => ({
      identifier: 'NEU-1',
      state: Promise.resolve({ type: 'completed', name: 'Done' }),
    }));
    const ctx = makeContext({ commits: [{ message: 'fix: NEU-1 bug' }] });
    await success(makeConfig(), ctx);
    assert.ok(ctx.logger.has('log', 'already completed'));
  });

  it('skips issue that is canceled', async () => {
    linearApiMock.fetchIssue.mock.mockImplementationOnce(async () => ({
      identifier: 'NEU-1',
      state: Promise.resolve({ type: 'canceled', name: 'Cancelled' }),
    }));
    const ctx = makeContext({ commits: [{ message: 'fix: NEU-1 bug' }] });
    await success(makeConfig(), ctx);
    assert.ok(ctx.logger.has('log', 'canceled'));
  });

  it('logs success after updating an issue', async () => {
    const ctx = makeContext({ commits: [{ message: 'fix: NEU-1 bug' }] });
    await success(makeConfig(), ctx);
    assert.ok(ctx.logger.has('log', 'NEU-1'));
  });

  it('warns when issueUpdate does not succeed', async () => {
    linearApiMock.fetchIssue.mock.mockImplementationOnce(async () => ({
      identifier: 'NEU-1',
      state: Promise.resolve({ type: 'unstarted', name: 'Todo' }),
      update: async () => ({ success: false }),
    }));
    const ctx = makeContext({ commits: [{ message: 'fix: NEU-1 bug' }] });
    await success(makeConfig(), ctx);
    assert.ok(ctx.logger.has('warn', 'did not succeed'));
  });

  it('logs error and continues when fetchIssue throws', async () => {
    linearApiMock.fetchIssue.mock.mockImplementationOnce(async () => {
      throw new Error('timeout');
    });
    const ctx = makeContext({
      commits: [{ message: 'fix: NEU-1 and NEU-2 bugs' }],
    });
    await success(makeConfig({ issuePrefixes: ['NEU'] }), ctx);
    assert.ok(ctx.logger.has('error', 'timeout'));
  });

  it('falls back to raw id in log when updatedIssue has no identifier', async () => {
    linearApiMock.fetchIssue.mock.mockImplementationOnce(async () => ({
      identifier: 'NEU-1',
      state: Promise.resolve({ type: 'unstarted', name: 'Todo' }),
      update: async () => ({
        success: true,
        issue: Promise.resolve(null),
      }),
    }));
    const ctx = makeContext({ commits: [{ message: 'fix: NEU-1 bug' }] });
    await success(makeConfig(), ctx);
    assert.ok(ctx.logger.has('log', 'NEU-1'));
  });
});
