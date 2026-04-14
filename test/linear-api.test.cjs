const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { pickDoneWorkflowStateId } = require('../lib/linear-api.js');

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

  it('returns null when no completed states', () => {
    assert.equal(
      pickDoneWorkflowStateId([{ id: 'z', name: 'Todo', type: 'unstarted' }]),
      null
    );
  });
});
