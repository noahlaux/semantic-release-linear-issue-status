const { describe, it, mock, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  createLinearClient,
  fetchTeamStates,
  fetchIssue,
  updateIssueState,
  pickDoneWorkflowStateId,
} = require('../lib/linear-api.js');

// ---------------------------------------------------------------------------
// pickDoneWorkflowStateId
// ---------------------------------------------------------------------------

describe('pickDoneWorkflowStateId', () => {
  const states = [
    { id: 'a', name: 'In Progress', type: 'started', position: 1 },
    { id: 'b', name: 'Done', type: 'completed', position: 3 },
    { id: 'c', name: 'Duplicate', type: 'completed', position: 2 },
  ];

  it('prefers completed state named Done', () => {
    assert.equal(pickDoneWorkflowStateId(states, 'done'), 'b');
  });

  it('falls back to first completed by position then name', () => {
    const noDoneName = [
      { id: 'x', name: 'Shipped', type: 'completed', position: 2 },
      { id: 'y', name: 'Released', type: 'completed', position: 1 },
    ];
    assert.equal(pickDoneWorkflowStateId(noDoneName, 'done'), 'y');
  });

  it('breaks position ties by name alphabetically', () => {
    const tied = [
      { id: 'p', name: 'Shipped', type: 'completed', position: 1 },
      { id: 'q', name: 'Released', type: 'completed', position: 1 },
    ];
    assert.equal(pickDoneWorkflowStateId(tied, 'done'), 'q');
  });

  it('returns null when no completed states', () => {
    assert.equal(pickDoneWorkflowStateId([{ id: 'z', name: 'Todo', type: 'unstarted' }]), null);
  });
});

// ---------------------------------------------------------------------------
// createLinearClient
// ---------------------------------------------------------------------------

describe('createLinearClient', () => {
  it('returns an object with the expected client shape', () => {
    const client = createLinearClient('lin_api_test');
    assert.ok(typeof client === 'object' && client !== null);
    assert.ok(typeof client.teams === 'function');
    assert.ok(typeof client.issue === 'function');
  });

  it('accepts an optional apiUrl override', () => {
    const client = createLinearClient('lin_api_test', 'https://example.com/graphql');
    assert.ok(typeof client === 'object');
  });
});

// ---------------------------------------------------------------------------
// fetchTeamStates
// ---------------------------------------------------------------------------

describe('fetchTeamStates', () => {
  it('returns state nodes for a matching team', async () => {
    const stateNodes = [{ id: 's1', name: 'Done', type: 'completed', position: 1 }];
    const mockClient = {
      teams: async () => ({
        nodes: [{ states: async () => ({ nodes: stateNodes }) }],
      }),
    };
    const result = await fetchTeamStates(mockClient, 'NEU');
    assert.deepEqual(result, stateNodes);
  });

  it('returns null when team is not found', async () => {
    const mockClient = {
      teams: async () => ({ nodes: [] }),
    };
    const result = await fetchTeamStates(mockClient, 'NOPE');
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// fetchIssue
// ---------------------------------------------------------------------------

describe('fetchIssue', () => {
  it('returns the issue when found', async () => {
    const fakeIssue = { id: 'uuid-1', identifier: 'NEU-42' };
    const mockClient = { issue: async () => fakeIssue };
    const result = await fetchIssue(mockClient, 'NEU-42');
    assert.deepEqual(result, fakeIssue);
  });

  it('returns null when the SDK throws (issue not found)', async () => {
    const mockClient = {
      issue: async () => {
        throw new Error('Entity not found');
      },
    };
    const result = await fetchIssue(mockClient, 'NEU-999');
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// updateIssueState
// ---------------------------------------------------------------------------

describe('updateIssueState', () => {
  it('calls issue.update with the given stateId and returns the payload', async () => {
    const payload = { success: true, issue: Promise.resolve({ identifier: 'NEU-42' }) };
    const fakeIssue = { update: async (input) => payload };
    const result = await updateIssueState(fakeIssue, 'state-id-done');
    assert.deepEqual(result, payload);
  });
});
