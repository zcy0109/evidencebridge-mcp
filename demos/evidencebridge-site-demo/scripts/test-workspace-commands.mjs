import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoDocuments, scenarios } from '../lib/demo-data.ts';
import {
  workspaceCommands,
  searchCommands,
} from '../lib/workspace-commands.ts';

test('every search destination resolves to a real view, example, or source', () => {
  assert.equal(
    new Set(workspaceCommands.map((item) => item.id)).size,
    workspaceCommands.length,
  );
  assert.equal(workspaceCommands.length, 12);
  for (const item of workspaceCommands) {
    if (item.kind === 'source')
      assert.ok(demoDocuments.some((doc) => doc.id === item.value));
    else if (item.kind === 'example') assert.ok(scenarios[item.value]);
    else assert.ok(['research', 'documents', 'audit'].includes(item.value));
  }
});

test('source filenames disambiguate old and new policy versions', () => {
  assert.deepEqual(
    searchCommands('research-policy-v1.md').map((item) => item.id),
    ['source-research-policy-v1'],
  );
  assert.deepEqual(
    searchCommands('research-policy-v2.md').map((item) => item.id),
    ['source-research-policy-v2'],
  );
  assert.deepEqual(
    searchCommands('  RESEARCH   v2  ').map((item) => item.id),
    ['source-research-policy-v2'],
  );
});

test('a visitor can discover a guided example by its actual question', () => {
  for (const [key, scenario] of Object.entries(scenarios)) {
    assert.deepEqual(
      searchCommands(scenario.question).map((item) => item.id),
      [`example-${key}`],
    );
  }
  assert.ok(
    searchCommands('attendance').some(
      (item) => item.id === 'example-attendance',
    ),
  );
});

test('empty queries show available destinations; unknown input never fabricates a destination', () => {
  assert.deepEqual(searchCommands(' \n  '), workspaceCommands);
  assert.deepEqual(searchCommands('nonexistent-document-4729'), []);
  assert.deepEqual(searchCommands('<img src=x onerror=alert(1)>'), []);
  assert.deepEqual(searchCommands('legal v999'), []);
});
