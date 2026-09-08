# Verification record

## Local authoring environment

- Date: 2026-09-08 (Asia/Shanghai)
- Node.js: 24.19.0 bundled runtime
- Python: 3.12.14 bundled runtime
- Docker: unavailable
- OpenAI/Azure credentials: not present

## Passed checks

| Check | Actual result |
|---|---|
| Flask + evaluation Pytest suite | 12 passed, 1 PostgreSQL test skipped |
| Python Ruff lint | Passed |
| MCP TypeScript build | Passed |
| Official MCP SDK stdio integration | 1 integration test passed; all 5 tools listed and invoked |
| Web provider/review tests | 4 passed |
| Web TypeScript check | Passed |
| Database package TypeScript build | Passed |
| Prisma schema validation | Passed |
| Next.js production build | Passed; 10 routes/pages generated |
| Deterministic 45-question evaluation | v1 baseline and v2 same-set regression completed; raw and summary records saved |
| PEFT split/metric smoke test | Passed; 24 records, 18 train / 6 test |
| Local production browser workflow | Passed: workspace, 3 uploads, streamed answer, MCP search/verify/review traces, locators, refusal gate, audit page |

## GitHub-hosted verification

- Date: 2026-09-09 (Asia/Shanghai)
- Environment: GitHub Actions Ubuntu runner with PostgreSQL 16 service
- Successful run: [ci run 34252155480](https://github.com/zcy0109/evidencebridge-mcp/actions/runs/34252155480)
- Prisma: checked-in migration `202609040001_init` applied successfully
- Python: 13 tests passed, including the PostgreSQL integration test
- TypeScript: MCP integration test (1) and Web provider/review tests (4) passed
- Build: database package, MCP server, and Next.js production build passed; 10 routes/pages generated
- Evaluation: deterministic 45-question evaluation command completed

## Not run locally

- PostgreSQL migration and integration test were not run on the authoring machine because Docker/PostgreSQL executables were unavailable; they were subsequently verified in GitHub Actions.
- Live OpenAI-compatible or Azure OpenAI calls, because no keys/resources were available.
- Apache public deployment.
- LoRA training, GPU measurements, or any formal PEFT experiment.

The final test command outputs, project tree, and saved evaluation files are the evidence for resume claims. “Configured” and “implemented” must not be rewritten as “deployed” or “production-tested.”
