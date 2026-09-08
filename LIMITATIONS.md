# Limitations

## Verified locally

- Text/Markdown ingestion, chunking, retrieval, citation verification, version comparison, human-review routing, audit events, conversation/tool-call memory persistence, and security validation tests.
- MCP server build plus real official-SDK stdio tool discovery and invocation using a deterministic service fixture.
- Next.js type-check, tests, and optimized production build.
- Prisma schema validation.
- A saved 45-question deterministic evaluation and PEFT metric/split smoke check.

## Implemented but not locally verified end to end

- PostgreSQL container startup, migration execution, and database integration test: Docker was not installed in the authoring environment. GitHub Actions and Docker Compose are configured to run it.
- Azure OpenAI: adapter implemented but not verified against a live Azure deployment. No subscription, resource, deployment, or key was available.
- OpenAI-compatible live generation: requires a user-supplied endpoint, key, and model.
- Apache deployment: configuration example only; no public host or TLS certificate was provisioned.

## Multimodal boundary

- Text-native PDFs are supported by `pypdf`; layout, tables, handwriting, and scanned pages may extract poorly.
- Image and audio files require an explicit sidecar transcript in the current default install. The adapter preserves image page and audio time fields, but no local OCR or speech model is bundled.
- A supplied transcript is treated as user-provided evidence. The system does not claim that it performed OCR or speech recognition.
- No in-house multimodal model was trained or evaluated.

## Retrieval and verification

- Retrieval is lexical plus document-version metadata, not embedding-based. It now supports explicit version filtering, latest-version tie-breaking, content-coverage ranking, and a small disclosed normalization map; unseen synonyms, multilingual queries, and semantic paraphrases can still rank poorly.
- The v2 1.000 metrics are in-sample regression results produced after the same 45 questions were inspected during error analysis. They show that known fixtures were closed, not that the retriever generalises to unseen documents or questions. A frozen holdout set is still required.
- Citation verification checks source-string agreement. It does not prove that a claim is entailed, complete, current, legally authoritative, or correctly interpreted.
- A similarity score can accept a close paraphrase; decision-critical uses should require an exact match plus human review.
- The mock answer selects the top chunk, so a verified but irrelevant quote remains possible. Informative-term support and review routing reduce but do not eliminate this risk.

## Operational limits

- The in-memory repository is single-process and ephemeral; it is only for the no-Docker demo.
- The built-in rate limiter is per Flask process. Public multi-worker deployments need a shared Redis/gateway limiter.
- Authentication is a service token, not a complete end-user identity, organisation, or row-level access-control system.
- Audit records are append-oriented at application level but are not cryptographically immutable.
- Malware scanning, DLP, backups, retention jobs, observability dashboards, and disaster recovery are out of scope.

## PEFT status

The LoRA training script and small labelled router dataset are present. Only the offline split/metric smoke test is run. No base, prompt-only, or LoRA model result is claimed, because model weights and suitable compute were not used in the authoring environment.
