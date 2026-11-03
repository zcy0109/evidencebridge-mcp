# Public demo validation — 2026-11-03

The current browser-verified source is commit `603ddd0fb18084ec8135bea934d2326a203e1651`. [Public demo CI](https://github.com/zcy0109/evidencebridge-mcp/actions/runs/41637047590) completed successfully. Its source hashes were checked against the local release candidate before saving this evidence.

## Verified

- Fresh installation with the frozen demo lockfile on Linux, Node.js 24 and pnpm 11.19.0.
- 17 source/replay/search/comparison tests, type checking, production build and seven SSR/offline packaging checks.
- 24/24 Chromium browser groups: source citations, policy excerpts, explicit legal-review boundary, audit JSON download, document filtering, controlled clipboard success/failure and stale results, keyboard commands, focus restoration, native dialogs and skip navigation.
- Layout checks at 1440, 1024, 768, 390 and 320 pixels. Desktop and mobile screenshots were reviewed for visible layout problems. These are emulated viewports, not physical-device or Safari tests.

[Release record](release-validation-2026-11-03.json) · [Raw browser report](ui/2026-11-03T12-36-36.067Z.json) · [Desktop screenshot](ui/2026-11-03T12-36-36.067Z-research-1440.png) · [Mobile screenshot](ui/2026-11-03T12-36-36.067Z-research-390.png) · [Downloaded illustrative audit JSON](ui/2026-11-03T12-36-36.067Z-export.json)

## Failures retained

| Check | Observed result | Resolution |
| --- | --- | --- |
| Initial workflow validation, run 41619764183 | No jobs executed | Moved runner context from job-level environment to step environment. |
| [Browser run 41620106423](https://github.com/zcy0109/evidencebridge-mcp/actions/runs/41620106423) | 8 groups passed; clipboard-message assertion failed | Wait for rendered visible feedback; the failure screenshot already showed the correct message. [Raw report](ui/2026-11-03T10-33-15.690Z.json). |
| [Browser run 41635985670](https://github.com/zcy0109/evidencebridge-mcp/actions/runs/41635985670) | 13 groups passed; source-selection assertion read the preceding document | Wait for the selected option and animation-frame source navigation. [Raw report](ui/2026-11-03T12-29-01.456Z.json). |
| Local Mac browser probe | Chrome aborted before inspecting the page | Browser acceptance ran in an isolated Linux CI context instead. No local browser pass is claimed. |
| Screenshot review | Unfocused skip link appeared in a scrolled full-page capture | Explicitly clip it when unfocused and add a first-Tab/Enter navigation check. Latest 24-group run passed. |

The earlier `github-sync-validation-2026-11-03.json`, `refinement-validation-2026-11-03.json`, `interaction-validation-2026-11-03.json` and `validation-run.json` are historical records. Their narrower browser-unverified status remains accurate for those runs.

## Reproduce

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build:preview
pnpm preview --strictPort
# In a second terminal with Playwright and Chromium already installed:
node scripts/verify-ui.mjs
```

The preview uses loopback port 4178. `EVIDENCEBRIDGE_PLAYWRIGHT_MODULE` and `EVIDENCEBRIDGE_CHROMIUM_PATH` optionally select an installed driver and browser. The GitHub workflow installs pinned tools separately and preserves fresh reports as artifacts; it removes checked-in historical browser outputs before executing tests.

## Scope

The frontend is a synthetic, prewritten static replay. Browser passes do not prove a live model, MCP invocation, document upload, real review submission or server audit persistence. Clipboard outcomes use controlled promises and do not certify OS clipboard permissions. Public Vercel publication is still pending renewed account login; no deployment result is claimed here.
