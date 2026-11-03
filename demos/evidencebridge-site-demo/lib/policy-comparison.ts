import { demoDocuments, scenarios } from './demo-data.ts';

/** Isolate one changed span at word boundaries, preserving original whitespace.
 * Used for the short deadline sentence; not a general policy-diff algorithm.
 */
export function splitWordChange(before: string, after: string) {
  const oldWords = before.match(/\s+|[^\s]+/gu) ?? [];
  const newWords = after.match(/\s+|[^\s]+/gu) ?? [];
  let start = 0;
  while (
    start < oldWords.length &&
    start < newWords.length &&
    oldWords[start] === newWords[start]
  )
    start++;
  let oldEnd = oldWords.length,
    newEnd = newWords.length;
  while (
    oldEnd > start &&
    newEnd > start &&
    oldWords[oldEnd - 1] === newWords[newEnd - 1]
  ) {
    oldEnd--;
    newEnd--;
  }
  return {
    prefix: oldWords.slice(0, start).join(''),
    before: oldWords.slice(start, oldEnd).join(''),
    after: newWords.slice(start, newEnd).join(''),
    suffix: oldWords.slice(oldEnd).join(''),
  };
}

export function deadlineComparison() {
  const scenario = scenarios.version;
  const before = demoDocuments.find(
    (doc) => doc.id === scenario.previousSourceId,
  );
  const after = demoDocuments.find((doc) => doc.id === scenario.sourceId);
  if (!before || !after)
    throw new Error('The comparison requires both source documents.');
  const beforeText = before.lines[scenario.sourceLine - 1]?.match(
    /^Applications close on [^.]+\./u,
  )?.[0];
  const afterText = after.lines[scenario.sourceLine - 1]?.match(
    /^Applications close on [^.]+\./u,
  )?.[0];
  if (!beforeText || !afterText)
    throw new Error('The deadline excerpt is missing at its source location.');
  return {
    line: scenario.sourceLine,
    before: { source: before, text: beforeText },
    after: { source: after, text: afterText },
    change: splitWordChange(beforeText, afterText),
  };
}
