#!/usr/bin/env node
/**
 * Actual browser QA for the local static replay, not a model/backend test.
 * Start the built site separately, then run: node scripts/verify-ui.mjs
 * Requires an existing Playwright install and Chromium; nothing is installed.
 * BASE_URL defaults to http://127.0.0.1:4178 and must remain a loopback URL.
 * EVIDENCEBRIDGE_PLAYWRIGHT_MODULE / EVIDENCEBRIDGE_CHROMIUM_PATH are optional.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const startedAt = new Date().toISOString();
const runId = startedAt.replaceAll(':', '-');
const outputDirectory = join(root, 'verification', 'ui');
mkdirSync(outputDirectory, { recursive: true });
const checks = [];
const screenshots = [];
const pageErrors = [];
const browserConsoleErrors = [];
const blockedExternalRequests = [];
const widths = [1440, 1024, 768, 390, 320];
let browser, context, page, baseUrl, browserVersion, driverVersion, exportArtifact, failure;

const questions = {
  attendance: 'What seminar attendance is required?',
  version: 'When do applications close in the latest policy?',
  legal: 'Should I appeal within 21 days?',
};
const exampleLabels = { attendance: 'Attendance requirement', version: 'Policy deadline', legal: 'Legal review' };
const sourceLines = '.source-inspector .source-lines';

async function assertFocused(locator) {
  const handle = await locator.elementHandle();
  assert.ok(handle, 'The expected focus target must exist');
  try {
    await page.waitForFunction((element) => document.activeElement === element, handle);
  } finally {
    await handle.dispose();
  }
}

function findDialog() {
  return page.getByRole('dialog', { name: 'Find anything', exact: true });
}

async function openFind() {
  await page.getByRole('button', { name: 'Find anything', exact: true }).click();
  const dialog = findDialog();
  await dialog.waitFor({ state: 'visible' });
  assert.equal(await dialog.evaluate((element) => element.tagName), 'DIALOG', 'Find anything must use a native modal dialog');
  const input = dialog.getByLabel('Search workspace', { exact: true });
  await input.waitFor();
  await assertFocused(input);
  return { dialog, input };
}

async function assertDialogFits(dialog, width) {
  const bounds = await dialog.boundingBox();
  assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1, `Dialog extends outside ${width}px viewport`);
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
  assert.ok(dimensions.page <= dimensions.viewport + 1, 'Opening a modal must not create horizontal page overflow');
}

async function loadDriver() {
  const configured = process.env.EVIDENCEBRIDGE_PLAYWRIGHT_MODULE || 'playwright';
  const specifier = isAbsolute(configured) ? pathToFileURL(configured).href : configured;
  let driver;
  try { driver = await import(specifier); } catch {
    throw new Error('An installed Playwright module is required. Set EVIDENCEBRIDGE_PLAYWRIGHT_MODULE when it is outside this repository.');
  }
  assert.ok(driver.chromium, 'The configured driver must export chromium');
  try {
    const packagePath = specifier.startsWith('file:')
      ? join(dirname(fileURLToPath(specifier)), 'package.json')
      : createRequire(import.meta.url).resolve('playwright/package.json');
    driverVersion = JSON.parse(readFileSync(packagePath, 'utf8')).version;
  } catch { driverVersion = 'unknown'; }
  return driver;
}

async function selectExample(key) {
  await page.locator('.primary-nav').getByRole('button', { name: 'Research', exact: true }).click();
  await page.getByRole('button', { name: exampleLabels[key], exact: true }).click();
  await page.waitForFunction((question) => document.querySelector('.research-note h2')?.textContent === question, questions[key]);
  assert.equal(await page.getByRole('button', { name: exampleLabels[key], exact: true }).getAttribute('aria-pressed'), 'true');
}

async function showView(label) {
  await page.locator('.primary-nav').getByRole('button', { name: new RegExp(`^${label}`) }).click();
  const selector = label === 'Research' ? '.research-note' : label === 'Documents' ? '.documents-view' : '.audit-view';
  await page.locator(selector).waitFor();
  await page.getByRole('heading', { level: 1, name: label, exact: true }).waitFor();
  assert.match(await page.locator('.replay-disclosure').innerText(), /Prewritten examples using synthetic sources\. No live model\./);
  assert.equal(await page.locator('.replay-disclosure').isVisible(), true);
}

async function screenshot(label) {
  const path = join(outputDirectory, `${runId}-${label}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled', timeout: 10_000 });
  screenshots.push(relative(root, path));
}

const plan = [
  {
    name: 'local page opens in a fresh browser context without a user profile',
    async run() {
      const parsed = new URL(process.env.BASE_URL || 'http://127.0.0.1:4178');
      assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname), 'Only a loopback test site is allowed');
      assert.equal(parsed.protocol, 'http:', 'This local QA runner is HTTP-only; it does not certify HTTPS');
      assert.ok(!parsed.username && !parsed.password, 'URL credentials are not supported');
      baseUrl = parsed.origin;
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(5000), redirect: 'error' });
      assert.equal(response.status, 200, 'Start the built local site before browser QA');
      await response.arrayBuffer();
      const driver = await loadDriver();
      browser = await driver.chromium.launch({
        headless: true,
        timeout: 15_000,
        ...(process.env.EVIDENCEBRIDGE_CHROMIUM_PATH ? { executablePath: process.env.EVIDENCEBRIDGE_CHROMIUM_PATH } : {}),
        args: ['--disable-background-networking', '--disable-component-update', '--disable-sync'],
      });
      browserVersion = browser.version();
      context = await browser.newContext({
        viewport: { width: 1440, height: 1000 }, acceptDownloads: true,
        reducedMotion: 'reduce', serviceWorkers: 'block',
      });
      await context.route('**/*', async (route) => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.origin === baseUrl || requestUrl.protocol === 'blob:') await route.continue();
        else {
          blockedExternalRequests.push({ origin: requestUrl.origin, resource_type: route.request().resourceType() });
          await route.abort('blockedbyclient');
        }
      });
      // Controlled clipboard promises test feedback, never the OS clipboard.
      // Failure is the default; a later test resolves one deferred mock call.
      await context.addInitScript(() => {
        window.__evidencebridgeCopyAttempts = 0;
        window.__evidencebridgeCopyMode = 'reject';
        window.__evidencebridgeReleaseCopy = null;
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
          writeText: async () => {
            window.__evidencebridgeCopyAttempts += 1;
            if (window.__evidencebridgeCopyMode === 'defer') {
              await new Promise((resolve) => { window.__evidencebridgeReleaseCopy = resolve; });
              return;
            }
            throw new Error('Controlled clipboard rejection');
          },
        } });
      });
      page = await context.newPage();
      page.setDefaultTimeout(10_000);
      page.on('pageerror', (error) => pageErrors.push({ name: error.name, message: error.message.slice(0, 1000) }));
      page.on('console', (message) => { if (message.type() === 'error') browserConsoleErrors.push(message.text().slice(0, 1000)); });
      await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 15_000 });
      await page.getByRole('heading', { level: 1, name: 'Research', exact: true }).waitFor();
      assert.match(await page.locator('.replay-disclosure').innerText(), /Prewritten examples using synthetic sources\. No live model\./);
      assert.equal(await page.locator('.replay-disclosure').getByRole('link', { name: 'Run the full application', exact: true }).count(), 1);
    },
  },
  {
    name: 'the first keyboard stop reveals a skip link and Enter focuses the workspace',
    async run() {
      const skip = page.getByRole('link', { name: 'Skip to workspace', exact: true });
      await page.keyboard.press('Tab');
      await assertFocused(skip);
      const bounds = await skip.boundingBox();
      assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 1000, 'The focused skip link must be inside the viewport');
      await page.keyboard.press('Enter');
      await assertFocused(page.locator('#main-content'));
    },
  },
  {
    name: 'initial attendance answer links to the original source at line three',
    async run() {
      assert.equal(await page.locator('.research-note h2').innerText(), questions.attendance);
      assert.match(await page.locator('.answer-text').innerText(), /Students must attend at least 80 percent of seminars/);
      assert.equal(await page.locator(`${sourceLines} .is-highlighted`).count(), 1);
      assert.equal(await page.locator(`${sourceLines} .is-highlighted .line-number`).innerText(), '03');
      assert.match(await page.locator(`${sourceLines} .is-highlighted`).innerText(), /Students must attend at least 80 percent/);
      assert.match(await page.locator('.source-inspector .document-filename').innerText(), /teaching-handbook\.md/);
    },
  },
  {
    name: 'version comparison shows only the labelled deadline excerpts and opens both original sources',
    async run() {
      await selectExample('version');
      assert.match(await page.locator('.answer-text').innerText(), /15 May in version 2/);
      const comparison = page.getByRole('region', { name: 'Policy version comparison', exact: true });
      assert.equal(await comparison.locator('.version-excerpt').count(), 2);
      assert.deepEqual(await comparison.locator('.comparison-text').allTextContents(), ['Applications close on 1 May.', 'Applications close on 15 May.']);
      assert.deepEqual(await comparison.locator('del').allTextContents(), ['1']);
      assert.deepEqual(await comparison.locator('ins').allTextContents(), ['15']);
      assert.match(await comparison.innerText(), /Deadline excerpt.*line 5/s);
      assert.match(await comparison.innerText(), /research-policy-v1\.md/);
      assert.match(await comparison.innerText(), /research-policy-v2\.md/);
      assert.match(await page.locator('.source-inspector .document-filename').innerText(), /research-policy-v2\.md/);
      assert.equal(await page.locator(`${sourceLines} .is-highlighted .line-number`).innerText(), '05');
      const trail = page.locator('details.evidence-trail');
      assert.equal(await trail.getAttribute('open'), null, 'Tool details start collapsed');
      await trail.locator('summary').click();
      assert.ok((await page.locator('.evidence-trail code').allTextContents()).includes('compare_document_versions'));
      await comparison.getByRole('button', { name: 'Read version 1', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.source-inspector .document-filename')?.textContent?.includes('research-policy-v1.md'));
      assert.equal(await page.locator(`${sourceLines} .is-highlighted`).count(), 0, 'The older source must not inherit the current citation highlight');
      await comparison.getByRole('button', { name: 'Read version 2', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.source-inspector .document-filename')?.textContent?.includes('research-policy-v2.md'));
      assert.equal(await page.locator(`${sourceLines} .is-highlighted .line-number`).innerText(), '05');
    },
  },
  {
    name: 'legal example withholds advice and discloses that no review is submitted',
    async run() {
      await selectExample('legal');
      assert.match(await page.locator('.answer-text').innerText(), /withholds a legal recommendation/);
      assert.match(await page.locator('.answer-text').innerText(), /No review request is created/);
      assert.match(await page.locator('.review-boundary').innerText(), /No review request is sent/);
      assert.equal((await page.locator('.evidence-trail code').allTextContents()).at(-1), 'request_human_review');
      assert.equal(await page.locator('.answer-status').innerText(), 'Review boundary illustrated');
    },
  },
  {
    name: 'audit view and downloaded JSON reflect the selected legal replay',
    async run() {
      await showView('Audit replay');
      const codes = await page.locator('.audit-events code').allTextContents();
      assert.ok(codes.includes('request_human_review'));
      assert.equal(codes.at(-1), 'demo.review_boundary_shown');
      assert.ok(!codes.some((code) => code.includes('answer_released') || code.includes('answer.released') || code === 'demo.answer_shown'));
      assert.match(await page.locator('.audit-disclosure').innerText(), /not server logs/);
      const [download] = await Promise.all([
        page.waitForEvent('download'), page.getByRole('button', { name: 'Export replay', exact: true }).click(),
      ]);
      assert.equal(download.suggestedFilename(), 'evidencebridge-legal-replay.json');
      const stream = await download.createReadStream();
      assert.ok(stream, 'The replay download must have readable content');
      const chunks = [];
      let bytes = 0;
      for await (const chunk of stream) {
        bytes += chunk.length;
        assert.ok(bytes <= 64 * 1024, 'The fixture replay is unexpectedly large');
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks);
      const payload = JSON.parse(content.toString('utf8'));
      assert.equal(payload.scenario, 'legal');
      assert.equal(payload.question, questions.legal);
      assert.match(payload.disclosure, /Not server audit records or live MCP execution/);
      assert.deepEqual(payload.events.map(({ event }) => event), codes);
      assert.ok(payload.events.every((event) => !('timestamp' in event) && !('duration_ms' in event)));
      const path = join(outputDirectory, `${runId}-export.json`);
      writeFileSync(path, content);
      exportArtifact = { path: relative(root, path), bytes, sha256: createHash('sha256').update(content).digest('hex') };
    },
  },
  {
    name: 'browsing another source clears the citation highlight and returning focuses the cited source',
    async run() {
      await page.locator('.sidebar-sources').getByRole('button', { name: /Public Information Guide/ }).click();
      await page.waitForFunction(() => document.querySelector('.source-inspector .document-filename')?.textContent?.includes('public-information-guide.md'));
      assert.equal(await page.locator(`${sourceLines} .is-highlighted`).count(), 0);
      assert.match(await page.locator('.source-context .overline').innerText(), /BROWSING THE LIBRARY/);
      await page.getByRole('button', { name: 'Return to the cited source', exact: true }).click();
      await page.waitForFunction(() => document.activeElement === document.querySelector('.source-inspector .source-lines .is-highlighted'));
      assert.match(await page.locator('.source-inspector .document-filename').innerText(), /research-policy-v2\.md/);
      assert.equal(await page.locator(`${sourceLines} .is-highlighted .line-number`).innerText(), '05');
    },
  },
  {
    name: 'document filtering reports both real matches and an honest empty state',
    async run() {
      await showView('Documents');
      assert.equal(await page.locator('.document-row').count(), 6);
      await page.getByRole('textbox', { name: 'Filter documents', exact: true }).fill('research-policy');
      await page.waitForFunction(() => document.querySelectorAll('.document-row').length === 2);
      await page.getByRole('textbox', { name: 'Filter documents', exact: true }).fill('no-such-document');
      await page.locator('.documents-view .empty-state').waitFor();
      assert.equal(await page.locator('.document-row').count(), 0);
      assert.match(await page.locator('.documents-view .empty-state').innerText(), /No documents match/);
      await page.getByRole('textbox', { name: 'Filter documents', exact: true }).fill('');
      await page.waitForFunction(() => document.querySelectorAll('.document-row').length === 6);
    },
  },
  {
    name: 'research offers three explicit replay cases without a question form or answer-generation control',
    async run() {
      await showView('Research');
      assert.equal(await page.locator('textarea, form').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Show example', exact: true }).count(), 0);
      assert.equal(await page.getByRole('tab').count(), 0, 'Case selectors use pressed buttons, not incomplete tab semantics');
      for (const key of Object.keys(exampleLabels)) {
        const button = page.getByRole('button', { name: exampleLabels[key], exact: true });
        assert.equal(await button.count(), 1);
        assert.ok(['true', 'false'].includes(await button.getAttribute('aria-pressed')));
      }
      await selectExample('attendance');
      assert.equal(await page.locator(`${sourceLines} .is-highlighted .line-number`).innerText(), '03');
    },
  },
  {
    name: 'a rejected clipboard operation displays failure rather than claiming success',
    async run() {
      await page.getByRole('button', { name: 'Copy citation', exact: true }).click();
      await page.waitForFunction(() => {
        const notice = document.querySelector('.live-notice');
        return notice instanceof HTMLElement
          && getComputedStyle(notice).visibility === 'visible'
          && notice.innerText.includes('Select the source text to copy it');
      });
      assert.equal(await page.evaluate(() => window.__evidencebridgeCopyAttempts), 1);
      assert.match(await page.locator('.live-notice').innerText(), /Select the source text to copy it/);
      assert.ok(!(await page.locator('.live-notice').innerText()).includes('Citation copied'));
      assert.equal(await page.locator('.live-notice').getAttribute('role'), 'status');
      assert.equal(await page.getByRole('button', { name: 'Copy citation', exact: true }).count(), 1);
    },
  },
  {
    name: 'keyboard activation selects an explicit example and citation navigation restores the invoking button',
    async run() {
      const example = page.getByRole('button', { name: exampleLabels.version, exact: true });
      await example.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction((question) => document.querySelector('.research-note h2')?.textContent === question, questions.version);
      const citation = page.getByRole('button', { name: 'Inspect citation 1 in source', exact: true });
      await citation.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement === document.querySelector('.source-inspector .source-lines .is-highlighted'));
      await page.getByRole('button', { name: 'Return to answer', exact: true }).click();
      await assertFocused(citation);
    },
  },
  {
    name: 'Find anything opens a native dialog with labelled search and Escape restores its opener',
    async run() {
      const opener = page.getByRole('button', { name: 'Find anything', exact: true });
      const { dialog } = await openFind();
      assert.equal(await dialog.getByRole('listbox').count(), 1);
      assert.ok(await dialog.getByRole('option').count() > 0, 'The palette must offer real workspace destinations');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await assertFocused(opener);
    },
  },
  {
    name: 'both Ctrl K and Command K toggle workspace search and restore the selected case button',
    async run() {
      await selectExample('attendance');
      const selectedCase = page.getByRole('button', { name: exampleLabels.attendance, exact: true });
      for (const shortcut of ['Control+k', 'Meta+k']) {
        await selectedCase.focus();
        await page.keyboard.press(shortcut);
        await findDialog().waitFor({ state: 'visible' });
        await page.keyboard.press(shortcut);
        await findDialog().waitFor({ state: 'hidden' });
        await assertFocused(selectedCase);
      }
    },
  },
  {
    name: 'command search filters sources, scenarios and views without inventing an empty-result destination',
    async run() {
      let palette = await openFind();
      const priorQuestion = await page.locator('.research-note h2').innerText();
      await palette.input.fill('no-such-workspace-destination');
      await page.waitForFunction(() => document.querySelector('dialog[open] [role="listbox"]')?.querySelectorAll('[role="option"]').length === 0);
      await palette.input.press('Enter');
      assert.equal(await palette.dialog.isVisible(), true, 'Enter on an empty search must not silently navigate');
      assert.equal(await page.locator('.research-note h2').innerText(), priorQuestion, 'An unknown destination must not fabricate an answer');
      await palette.input.fill('Public Information Guide');
      const sourceOption = palette.dialog.getByRole('option', { name: /Public Information Guide/ });
      await sourceOption.waitFor();
      await sourceOption.click();
      await palette.dialog.waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.querySelector('.source-inspector .document-filename')?.textContent?.includes('public-information-guide.md'));
      assert.equal(await page.locator(`${sourceLines} .is-highlighted`).count(), 0);

      palette = await openFind();
      await palette.input.fill('Policy deadline');
      await palette.dialog.getByRole('option', { name: /Policy deadline/ }).click();
      await palette.dialog.waitFor({ state: 'hidden' });
      await page.waitForFunction((question) => document.querySelector('.research-note h2')?.textContent === question, questions.version);

      palette = await openFind();
      await palette.input.fill('Audit replay');
      await palette.dialog.getByRole('option', { name: /Audit replay/ }).click();
      await palette.dialog.waitFor({ state: 'hidden' });
      await page.locator('.audit-view').waitFor();
      assert.match(await page.locator('.audit-question').innerText(), /When do applications close/);
    },
  },
  {
    name: 'command options expose selection and arrow keys plus Enter choose the selected document version',
    async run() {
      const { dialog, input } = await openFind();
      await input.fill('Research Policy');
      await page.waitForFunction(() => document.querySelector('dialog[open] [role="listbox"]')?.querySelectorAll('[role="option"]').length === 2);
      const selected = dialog.locator('[role="option"][aria-selected="true"]');
      assert.equal(await selected.count(), 1, 'Exactly one option must expose selection');
      const initial = await selected.innerText();
      await input.press('ArrowDown');
      await page.waitForFunction((prior) => {
        const option = document.querySelector('dialog[open] [role="option"][aria-selected="true"]');
        return option instanceof HTMLElement && option.innerText !== prior;
      }, initial);
      assert.equal(await selected.count(), 1);
      const next = await selected.innerText();
      assert.notEqual(next, initial, 'Policy version options must have distinct visible labels');
      await input.press('ArrowUp');
      await page.waitForFunction((label) => document.querySelector('dialog[open] [role="option"][aria-selected="true"]')?.innerText === label, initial);
      assert.equal(await selected.innerText(), initial);
      await input.press('ArrowDown');
      await page.waitForFunction((label) => document.querySelector('dialog[open] [role="option"][aria-selected="true"]')?.innerText === label, next);
      const choice = await selected.innerText();
      assert.match(choice, /(?:research-policy-v[12]\.md|[vV](?:ersion\s*)?[12])/);
      await input.press('Enter');
      await dialog.waitFor({ state: 'hidden' });
      const version = choice.match(/research-policy-v([12])\.md|[vV](?:ersion\s*)?([12])/)?.slice(1).find(Boolean);
      assert.ok(version, 'The selected policy version must be identifiable');
      await page.waitForFunction((filename) => document.querySelector('.source-inspector .document-filename')?.textContent?.includes(filename), `research-policy-v${version}.md`);
      assert.match(await page.locator('.source-inspector .document-filename').innerText(), new RegExp(`research-policy-v${version}\\.md`));
    },
  },
  {
    name: 'Focus reading toggles the desktop sidebar while retaining the active example',
    async run() {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await selectExample('attendance');
      const toggle = page.getByRole('button', { name: 'Focus reading', exact: true });
      assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
      await toggle.click();
      await page.locator('.sidebar').waitFor({ state: 'hidden' });
      assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
      assert.match(await page.locator('.answer-text').innerText(), /80 percent/);
      assert.equal(await page.locator(`${sourceLines} .is-highlighted .line-number`).innerText(), '03');
      await toggle.click();
      await page.locator('.sidebar').waitFor({ state: 'visible' });
      assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    },
  },
  {
    name: 'the source reader shows the cited line in a native dialog and closes with focus restoration',
    async run() {
      await selectExample('attendance');
      const opener = page.getByRole('button', { name: 'Open reader', exact: true });
      await opener.click();
      const reader = page.getByRole('dialog', { name: 'Read source', exact: true });
      await reader.waitFor({ state: 'visible' });
      assert.equal(await reader.evaluate((element) => element.tagName), 'DIALOG');
      assert.match(await reader.innerText(), /Students must attend at least 80 percent of seminars/);
      assert.equal(await reader.locator('.source-lines .is-highlighted .line-number').innerText(), '03');
      await page.keyboard.press('Control+k');
      assert.equal(await findDialog().isVisible(), false, 'The source reader must not open a competing search modal');
      assert.equal(await reader.isVisible(), true);
      await page.keyboard.press('Escape');
      await reader.waitFor({ state: 'hidden' });
      await assertFocused(opener);
      await opener.click();
      await reader.waitFor({ state: 'visible' });
      await reader.getByRole('button', { name: 'Close reader', exact: true }).click();
      await reader.waitFor({ state: 'hidden' });
      await assertFocused(opener);
    },
  },
  {
    name: 'copy feedback remains pending until a controlled clipboard promise resolves',
    async run() {
      await selectExample('attendance');
      await page.evaluate(() => { window.__evidencebridgeCopyMode = 'defer'; window.__evidencebridgeReleaseCopy = null; });
      const copyButton = page.locator('.note-actions button').first();
      await copyButton.click();
      await page.waitForFunction(() => typeof window.__evidencebridgeReleaseCopy === 'function');
      assert.equal(await copyButton.isDisabled(), true, 'Prevent duplicate writes while copying is pending');
      assert.equal(await copyButton.getAttribute('aria-busy'), 'true');
      assert.notEqual((await copyButton.innerText()).trim(), 'Copied', 'Do not claim success before the promise resolves');
      await page.evaluate(() => { window.__evidencebridgeReleaseCopy(); window.__evidencebridgeCopyMode = 'reject'; });
      await page.waitForFunction(() => document.querySelector('.note-actions button')?.textContent?.trim() === 'Copied');
      assert.equal(await copyButton.isDisabled(), false);
    },
  },
  {
    name: 'a clipboard completion cannot overwrite feedback after switching examples',
    async run() {
      await selectExample('attendance');
      await page.evaluate(() => { window.__evidencebridgeCopyMode = 'defer'; window.__evidencebridgeReleaseCopy = null; });
      await page.getByRole('button', { name: 'Copy citation', exact: true }).click();
      await page.waitForFunction(() => typeof window.__evidencebridgeReleaseCopy === 'function');
      await selectExample('version');
      await page.evaluate(async () => {
        window.__evidencebridgeReleaseCopy();
        window.__evidencebridgeCopyMode = 'reject';
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      assert.equal(await page.locator('.note-actions button').first().innerText(), 'Copy citation');
      assert.equal(await page.locator('.note-actions button').first().isDisabled(), false);
      assert.ok(!(await page.locator('.live-notice').innerText()).includes('Citation copied'));
      assert.equal(await page.locator('.research-note h2').innerText(), questions.version);
    },
  },
  ...widths.map((width) => ({
    name: `${width}px layout fits the research, documents, audit, command palette and source reader`,
    async run() {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      await page.waitForFunction((expected) => innerWidth === expected, width);
      for (const label of ['Research', 'Documents', 'Audit replay']) {
        await showView(label);
        const dimensions = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
        assert.ok(dimensions.page <= dimensions.viewport + 1, `${label} overflows at ${width}px: ${dimensions.page}px`);
      }
      await selectExample('attendance');
      const { dialog } = await openFind();
      await assertDialogFits(dialog, width);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Open reader', exact: true }).click();
      const reader = page.getByRole('dialog', { name: 'Read source', exact: true });
      await reader.waitFor({ state: 'visible' });
      await assertDialogFits(reader, width);
      await page.keyboard.press('Escape');
      await reader.waitFor({ state: 'hidden' });
      if (width === 1440 || width === 390) await screenshot(`research-${width}`);
    },
  })),
];

try {
  for (const entry of plan) {
    const started = performance.now();
    try {
      await entry.run();
      assert.equal(pageErrors.length, 0, 'The page reported an uncaught JavaScript error');
      checks.push({ name: entry.name, status: 'passed', duration_ms: Math.round(performance.now() - started) });
      console.log(`PASS ${entry.name}`);
    } catch (error) {
      checks.push({ name: entry.name, status: 'failed', duration_ms: Math.round(performance.now() - started), error: String(error.message).slice(0, 2000) });
      throw error;
    }
  }
} catch (error) {
  failure = String(error.message).slice(0, 2000);
  console.error(`FAIL ${failure}`);
  process.exitCode = 1;
  if (page && !page.isClosed()) {
    try { await screenshot('failure'); } catch { /* Preserve the actual failure even when rendering is unavailable. */ }
  }
} finally {
  try { await context?.close(); await browser?.close(); } catch (error) {
    failure ||= `Browser cleanup failed: ${String(error.message).slice(0, 1000)}`;
    process.exitCode = 1;
  }
  const report = {
    schema_version: 1,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    status: failure ? 'failed' : 'passed',
    scope: 'Actual local static-demo browser interactions and layout; not deployment, backend, real-model, HTTPS or automated visual-design approval.',
    base_url: baseUrl || 'unavailable',
    browser: { engine: 'chromium', version: browserVersion || 'unavailable', playwright_version: driverVersion || 'unavailable', context: 'new_ephemeral_context' },
    node_version: process.version,
    counts: { planned: plan.length, passed: checks.filter(({ status }) => status === 'passed').length, failed: checks.filter(({ status }) => status === 'failed').length, not_executed: plan.length - checks.length },
    checks,
    page_errors: pageErrors,
    browser_console_errors: browserConsoleErrors,
    blocked_external_requests: blockedExternalRequests,
    clipboard_test: 'Controlled rejected and deferred/resolved promises in an isolated browser context; no system clipboard access',
    export: exportArtifact || null,
    screenshots,
    source_sha256: Object.fromEntries(['app/page.tsx', 'app/globals.css', 'components/workspace-overlays.tsx', 'components/policy-comparison.tsx', 'lib/demo-data.ts', 'lib/workspace-commands.ts', 'lib/policy-comparison.ts', 'scripts/verify-ui.mjs'].map((file) => [file, createHash('sha256').update(readFileSync(join(root, file))).digest('hex')])),
    ...(failure ? { error: failure } : {}),
  };
  const reportPath = join(outputDirectory, `${runId}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ report: relative(root, reportPath), status: report.status, counts: report.counts, screenshots }, null, 2));
}
