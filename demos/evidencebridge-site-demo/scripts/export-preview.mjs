/** Package the static build into a browser-openable, offline HTML file.
 * SSR assertions check markup, not visual layout or browser interactions.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Home, { PolicyComparison, demoDocuments, scenarios } from '../.ui-check/preview-entry.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, 'out');
const checks = [];
function check(name, run) { run(); checks.push({ name, status: 'passed' }); }
const markup = renderToStaticMarkup(React.createElement(Home));
check('one main workspace heading and labelled source inspector', () => {
  assert.equal((markup.match(/<h1/g) || []).length, 1);
  assert.match(markup, /<h1\b[^>]*>Research<\/h1>/);
  assert.ok(markup.includes('aria-label="Source reference"'));
});
check('initial sample quote and exact original line number are present', () => {
  assert.ok(markup.includes('Students must attend at least 80 percent of seminars.'));
  assert.ok(markup.includes('aria-label="Line 3"'));
  assert.equal((markup.match(/class="is-highlighted"/g) || []).length, 1);
});
check('static replay and non-executed tools are disclosed', () => {
  assert.ok(markup.includes('Prewritten examples using synthetic sources. No live model.'));
  assert.match(markup, /<a\b[^>]*>[^<]*Run the full application/);
  assert.ok(markup.includes('These tools are not executed on this hosting surface.'));
  assert.match(markup, /<details\b[^>]*class="evidence-trail"/);
  assert.ok(!/<details\b[^>]*class="evidence-trail"[^>]*\bopen(?:=|\s|>)/.test(markup), 'Tool replay details start collapsed');
});
check('navigation and three explicit case selectors replace answer-generation inputs', () => {
  for (const text of ['Main views', 'Audit replay', 'Attendance requirement', 'Policy deadline', 'Legal review', 'Inspect citation 1 in source', 'Skip to workspace', 'Copy citation']) assert.ok(markup.includes(text));
  assert.ok(!/<(?:textarea|form)\b/.test(markup), 'A static replay must not suggest arbitrary questions are answered');
  assert.ok(!markup.includes('role="tab"'), 'Example buttons must not imply an incomplete tab interface');
  const picker = markup.match(/<div\b[^>]*class="example-picker"[^>]*>(.*?)<\/div>/s)?.[1];
  assert.ok(picker, 'The explicit case selector must be rendered');
  assert.equal((picker.match(/<button\b/g) || []).length, 3);
  assert.equal((picker.match(/aria-pressed="true"/g) || []).length, 1, 'Exactly one replay case starts selected');
  assert.equal((picker.match(/aria-pressed="false"/g) || []).length, 2);
});
check('interaction entry points have explicit accessible names and modal semantics', () => {
  for (const text of ['aria-label="Find anything"', 'aria-label="Focus reading"', 'aria-pressed="false"', 'Open reader', 'aria-haspopup="dialog"']) assert.ok(markup.includes(text));
  assert.equal((markup.match(/<dialog\b/g) || []).length, 2);
  assert.ok(!/<dialog\b[^>]*\bopen(?:=|\s|>)/.test(markup), 'Dialogs must start closed');
  assert.ok(!markup.includes('id="workspace-command-list"'), 'Closed search has no hidden keyboard targets');
  assert.ok(markup.includes('tabindex="-1" class="is-highlighted"'), 'The cited passage accepts programmatic focus');
});
check('policy comparison renders source-backed deadline excerpts with only the changed word marked', () => {
  const comparison = renderToStaticMarkup(React.createElement(PolicyComparison, { onInspect: () => {} }));
  assert.ok(comparison.includes('aria-label="Policy version comparison"'));
  const paragraphs = Array.from(comparison.matchAll(/<p\b[^>]*class="comparison-text"[^>]*>(.*?)<\/p>/gs), (match) => match[1].replace(/<[^>]+>/g, ''));
  assert.deepEqual(paragraphs, ['Applications close on 1 May.', 'Applications close on 15 May.']);
  const sourceIds = [scenarios.version.previousSourceId, scenarios.version.sourceId];
  paragraphs.forEach((excerpt, index) => {
    const source = demoDocuments.find(({ id }) => id === sourceIds[index]);
    assert.ok(source, 'Every comparison column resolves to an actual demo source');
    assert.ok(source.lines[scenarios.version.sourceLine - 1].includes(excerpt), 'The displayed excerpt must occur at the displayed original line');
    assert.ok(comparison.includes(source.filename));
    assert.ok(comparison.includes(`Read version ${source.version}`));
  });
  assert.ok(comparison.includes('Deadline excerpt'));
  assert.ok(comparison.includes(`line ${scenarios.version.sourceLine}`));
  assert.deepEqual(Array.from(comparison.matchAll(/<del\b[^>]*>(.*?)<\/del>/gs), (match) => match[1]), ['1']);
  assert.deepEqual(Array.from(comparison.matchAll(/<ins\b[^>]*>(.*?)<\/ins>/gs), (match) => match[1]), ['15']);
});
let html = readFileSync(join(out, 'index.html'), 'utf8').replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
function asset(url) {
  const path = resolve(out, url.replace(/^\//, ''));
  assert.ok(path.startsWith(out + sep), 'Asset must stay in build output');
  return readFileSync(path, 'utf8');
}
html = html.replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g, (_tag, url) => `<script type="module">${asset(url).replace(/<\/script/gi, '<\\/script')}</script>`);
html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_tag, url) => `<style>${asset(url).replace(/<\/style/gi, '<\\/style')}</style>`);
html = html.replace('href="/favicon.svg"', `href="data:image/svg+xml,${encodeURIComponent(readFileSync(join(root, 'public/favicon.svg'), 'utf8'))}"`);
check('offline preview has no linked asset or font dependency', () => {
  assert.ok(!/<script\b[^>]*\bsrc=/.test(html));
  assert.ok(!/<link\b[^>]*rel="stylesheet"/.test(html));
  assert.ok(!html.includes('fonts.googleapis.com'));
  assert.ok(html.includes('<div id="root"><div class="app-frame">'));
});
const directory = join(root, 'verification');
mkdirSync(directory, { recursive: true });
const preview = join(directory, 'design-preview.html');
writeFileSync(preview, html);
const report = { recorded_at: new Date().toISOString(), scope: 'React server-rendered structure and offline packaging only; not browser or visual QA', checks, preview_bytes: Buffer.byteLength(html), preview_sha256: createHash('sha256').update(html).digest('hex'), source_sha256: Object.fromEntries(['app/page.tsx', 'app/globals.css', 'lib/demo-data.ts', 'lib/workspace-commands.ts', 'lib/policy-comparison.ts', 'components/workspace-overlays.tsx', 'components/policy-comparison.tsx', 'scripts/preview-entry.tsx', 'scripts/export-preview.mjs'].map(file => [file, createHash('sha256').update(readFileSync(join(root, file))).digest('hex')])) };
writeFileSync(join(directory, 'design-checks.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ preview, checks: checks.length, scope: report.scope, bytes: report.preview_bytes }));
