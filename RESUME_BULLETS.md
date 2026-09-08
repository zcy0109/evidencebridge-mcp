# Resume-ready bullets

- Built **EvidenceBridge Multimodal MCP**, an evidence-grounded Next.js/React and Flask/Gunicorn research workbench that streams answers with verbatim source excerpts, document/page/line/time locators, citation checks, human-review routing, and an auditable tool trace.
- Implemented and integration-tested five callable tools with the official **Model Context Protocol TypeScript SDK**—document search, evidence retrieval, citation verification, version comparison, and human-review creation—using Zod schemas, service authentication, bounded inputs, and request timeouts.
- Modelled 10 durable entities in **PostgreSQL/Prisma** (including documents, chunks, evidence, conversations, tool calls, evaluation runs, and reviews), checked in a migration and seed, and connected Flask evidence operations with Prisma-based Next.js conversation persistence.
- Created a reproducible 45-question deterministic evaluation comparing direct answer, basic RAG, and citation-verified RAG; diagnosed version and short-chunk ranking failures, then improved the same-set regression from **0.825 to 1.000 retrieval recall** and **0.600 to 1.000 strict citation accuracy**, explicitly labelled as in-sample, non-LLM component results rather than generalisation evidence.
- Added file/type/page/size limits, path normalisation, prompt-injection detection, React output escaping, privacy-conscious audit metadata, rate limiting, error recovery, and unit/integration tests; verified the Next.js production build and MCP stdio execution locally.
- Implemented a unified deterministic, OpenAI-compatible, and Azure OpenAI provider boundary; documented the Azure adapter as **not live-verified** and kept all cloud credentials and deployment claims out of the repository.

Use only the bullets whose evidence remains in the repository and update measured values only by rerunning the checked-in evaluation.
