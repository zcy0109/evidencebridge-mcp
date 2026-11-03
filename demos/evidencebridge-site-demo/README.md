# EvidenceBridge public research demo

The static frontend for the EvidenceBridge research workspace. This snapshot includes the reading interface, three named cases, exact source quotations, policy deadline excerpts, command search, source reader, focus mode and illustrative audit export.

**This is a browser-local demonstration using synthetic sources and prewritten answers.** It does not upload documents, call a model or MCP server, create human-review tasks, or record server audit events. The complete backend lives elsewhere in the parent repository. Synchronizing this source to GitHub does not deploy it to the public domain.

## Run

Use Node.js 24 (the verified runtime) and pnpm 11.19.0. In this directory:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build:preview
pnpm preview
```

The preview server uses `http://127.0.0.1:4178`. `pnpm dev` starts the development server. `pnpm build` produces the Vercel static output in `out/`; `pnpm build:preview` also generates `verification/design-preview.html`, which can be opened offline. No credentials or hosting-account configuration are needed.

The nested `pnpm-workspace.yaml` and lockfile keep this demo's dependencies separate from the main application's workspace. Build commands use `vite.vercel.config.ts`; the source can be reviewed or built without linking a hosting account. `app/layout.tsx` is retained metadata from the original scaffold; the static entrypoint is `src/main.tsx`.

## Verification

The local candidate passed 17 source/replay/search/comparison tests, type checking, production build and seven server-rendered structure/packaging checks. Source parity tests resolve `../../examples/materials` from this demo directory when it is inside the repository. The original sibling-checkout layout is also supported.

Browser interaction and visual acceptance are **not verified**: the earlier automated browser launch failed before inspecting the page. The local-only browser suite in `scripts/verify-ui.mjs` is prepared, but its 23 acceptance groups are not counted as passing. See [verification notes](verification/README.md) and the timestamped records there. Published records retain actual output; workstation paths are redacted where necessary. Earlier records are historical and do not certify newer source changes.

The generated preview, personal `.openai`/`.vercel` identity, environment files, caches and installed dependencies are excluded from the GitHub snapshot. No publication or domain change is performed by these build scripts.
