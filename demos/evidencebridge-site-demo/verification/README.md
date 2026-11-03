# Local reading and case-flow candidate — 2026-11-03

This is a redesign of the public **static example replay**. It does not change the backend, execute MCP tools, create review requests, or certify a live provider. No deployment or push was performed.

Open `design-preview.html` directly in a browser. Its CSS, JavaScript, favicon, and initial React-rendered content are embedded. Repository links still require internet access. Clipboard access may be unavailable when opening a local file; the interface reports that failure.

## Design direction

The workspace organization draws on [Linear](https://linear.app/), and the emphasis on readable document hierarchy draws on [Notion](https://www.notion.com/product). These are structural references, not copied screens or assets. Warm paper, charcoal, restrained olive accents, serif reading titles, thin dividers, and a persistent source column replace the previous promotional banner and repeated cards. No external font or image dependency was added.

Research, Documents, and Audit replay are distinct views. Six synthetic sources preserve their original text and line numbers. The public UI exposes three named prewritten cases and has no answer-generation input. The audit export identifies itself as an illustrative replay rather than a server log.

The latest refinement removes the promotional headings, decorative numbering, sidebar quotation and repeated question entry. The case question is the primary reading heading; original source text is 15 px and common actions are 13 px. The mode disclosure remains visible in every main view, and tool details start collapsed. The policy case shows two source-backed deadline sentences with the changed date marked, explicit filenames and line numbers, and buttons to inspect each complete document. The comparison is labelled as an excerpt, since other policy text also differs.

## Interaction tour

1. Choose **Attendance requirement**, **Policy deadline**, or **Legal review** to see the corresponding conclusion and source. Select **Find anything** or press **⌘K / Ctrl K** to search a filename, example question, or view. Arrow keys move through destinations; Enter opens one and Escape closes search. Search navigates existing demo content, not generated answers.
2. Click citation **1** or its quotation. The actual cited source line receives focus and a brief highlight. **Return to answer** restores the citation that opened it. **Open reader** presents the complete source in a larger reading surface, with a bottom-sheet layout on small screens. Closing restores the opener.
3. On desktop, **Focus reading** hides the navigation rail while retaining sources and search. Use the same control to return. Copy feedback changes only after the clipboard operation resolves; failures remain visible and late results from another example are ignored.

Page and source transitions, disclosure arrows, button presses and citation feedback use brief CSS motion (at most 240 ms), with the system reduced-motion preference respected. No animation, search, or dialog package was added. Native dialogs provide modal focus containment and Escape behavior; the code restores body scrolling on close. These behaviors are implemented and awaiting real-browser acceptance as detailed below.

## Reproduce

From the project directory with a compatible Node.js installation and dependencies installed:

```sh
npm test
npm run typecheck
npm run build:preview
npm run preview
```

The local preview server uses port 4178. `build:preview` builds both the Vercel output and a temporary server-rendering bundle, runs seven markup/package assertions, then creates the standalone preview. `design-checks.json` records source and output hashes. `refinement-validation-2026-11-03.json` preserves this candidate's validation output. `interaction-validation-2026-11-03.json` and `validation-run.json` are historical snapshots and do not certify the latest changes.

## Verified scope and remaining check

The GitHub snapshot was also checked in its published directory layout; see [the synchronization validation record](github-sync-validation-2026-11-03.json). It passed all 17 tests without skips, type checking, the default static build and seven SSR/package checks. The six canonical materials matched the remote repository commit recorded there. Existing installed dependencies were reused; this does not certify a fresh installation or browser behavior.

- Passed: 17 source/replay/search/comparison tests, with no skips; TypeScript; static production build; seven server-rendered markup/offline packaging assertions, including rendered deadline excerpts and their actual source lines; whitespace check.
- The compatible runtime used here was Node.js 24.19.0. The default bundled runtime could not start on this Mac; no global runtime or system installation was changed.
- The previous automated browser launch failed before loading the page. This interaction pass did not repeat that unchanged failed setup. **No screenshot, visual acceptance, responsive layout, keyboard interaction, clipboard interaction, or download interaction is claimed as browser-verified.** Responsive rules and interaction code are implemented; they still require actual browser inspection.
- `scripts/verify-ui.mjs` provides a local-only browser acceptance suite for 1440, 1024, 768, 390 and 320 pixel widths. Its syntax was checked; the suite has not been executed. It needs an existing Playwright installation and compatible Chromium. Optional `EVIDENCEBRIDGE_PLAYWRIGHT_MODULE` and `EVIDENCEBRIDGE_CHROMIUM_PATH` select those existing installations; it installs nothing. Run it against the preview server before publishing.
- The public domain and Vercel deployment remain unchanged.
