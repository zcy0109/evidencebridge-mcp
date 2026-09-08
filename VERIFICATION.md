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

## Not run locally

- PostgreSQL migration and integration test, because Docker/PostgreSQL executables were unavailable.
- GitHub Actions, because the project was not pushed.
- Live OpenAI-compatible or Azure OpenAI calls, because no keys/resources were available.
- Apache public deployment.
- LoRA training, GPU measurements, or any formal PEFT experiment.

The final test command outputs, project tree, and saved evaluation files are the evidence for resume claims. “Configured” and “implemented” must not be rewritten as “deployed” or “production-tested.”
