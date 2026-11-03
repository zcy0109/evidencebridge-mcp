import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  deadlineComparison,
  splitWordChange,
} from '../lib/policy-comparison.ts';

test('both deadline excerpts come from their exact source locations', () => {
  const comparison = deadlineComparison();
  assert.equal(comparison.line, 5);
  assert.equal(comparison.before.source.filename, 'research-policy-v1.md');
  assert.equal(comparison.after.source.filename, 'research-policy-v2.md');
  assert.equal(comparison.before.text, 'Applications close on 1 May.');
  assert.equal(comparison.after.text, 'Applications close on 15 May.');
  for (const side of ['before', 'after']) {
    assert.ok(
      comparison[side].source.lines[comparison.line - 1].startsWith(
        comparison[side].text,
      ),
    );
    assert.notEqual(
      comparison[side].source.lines[comparison.line - 1],
      comparison[side].text,
      'The excerpt must not be described as the whole policy line',
    );
  }
});

test('highlighted date replacement preserves the complete old and new excerpts', () => {
  const comparison = deadlineComparison();
  const change = comparison.change;
  assert.equal(change.before, '1');
  assert.equal(change.after, '15');
  assert.equal(
    change.prefix + change.before + change.suffix,
    comparison.before.text,
  );
  assert.equal(
    change.prefix + change.after + change.suffix,
    comparison.after.text,
  );
});

test('word highlights do not invent changes for identical text or lose whitespace', () => {
  for (const [before, after] of [
    ['No change.', 'No change.'],
    ['A\told\nvalue', 'A\tnew\nvalue'],
    ['', 'new'],
    ['old', ''],
    ['旧  条文', '新  条文'],
  ]) {
    const change = splitWordChange(before, after);
    assert.equal(change.prefix + change.before + change.suffix, before);
    assert.equal(change.prefix + change.after + change.suffix, after);
    if (before === after) {
      assert.equal(change.before, '');
      assert.equal(change.after, '');
    }
  }
});
