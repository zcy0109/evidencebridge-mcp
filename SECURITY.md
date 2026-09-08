# Security

## Threat model

Uploaded files and every character extracted from them are untrusted. An attacker may attempt path traversal, oversized-input denial of service, parser abuse, prompt injection, HTML/script injection, cross-workspace access, tool argument manipulation, secret exfiltration, or misleading citations.

## Implemented controls

- **Upload boundary:** extension allowlist; `secure_filename`; basename normalisation; 10 MiB default request cap; UTF-8 requirement; 200-page PDF cap; bounded chunk sizes; empty-extraction rejection.
- **Prompt injection:** suspicious instruction patterns are flagged in the audit event, and the agent system instruction treats source content only as data. Source text never changes tool permissions.
- **Output safety:** Flask returns JSON, React escapes strings, and no source HTML is rendered with `dangerouslySetInnerHTML`.
- **Tool safety:** all MCP tools use explicit Zod schemas, UUID workspace/resource identifiers, bounded strings and result limits. Tool execution occurs server-side.
- **Authority:** Flask accepts a constant-time compared bearer service token outside health checks. The browser never receives this token.
- **Reliability:** MCP/Flask calls use abort timeouts; MCP transports close in `finally`; errors return stable, non-sensitive messages.
- **Abuse controls:** per-process rate limit defaults to 120 requests/minute/client. Apache caps request bodies. Public deployments should enforce stronger limits at the edge.
- **Privacy:** no keys are logged; retrieval audit events store a query hash and length rather than the raw question; tool traces store bounded summaries. Conversation content is persisted because it is a core user-visible record and therefore requires an explicit retention policy in production.
- **Evidence policy:** final answers cannot change server verification results. Absent, weak, mismatched, conflicting, or high-risk cases are routed to review.
- **Headers:** no-store caching, MIME sniffing protection, and frame denial are set by Flask; Apache adds a referrer policy.

## Known gaps before public deployment

1. Add end-user authentication, workspace membership, object-level authorisation, CSRF protection where cookie auth is introduced, and PostgreSQL row-level policies where appropriate.
2. Put uploads in quarantined object storage and add malware scanning, decompression limits, PDF sandboxing, content-disposition controls, and retention/deletion jobs.
3. Replace the process-local rate limiter with gateway or Redis enforcement; add distributed tracing, alerting, backup tests, and incident runbooks.
4. Use a secrets manager and workload identity. Rotate service tokens and database credentials; never use the `.env.example` password outside local development.
5. Add TLS, a restrictive Content Security Policy, explicit trusted proxy configuration, and network rules that prevent public access to Flask/PostgreSQL.
6. Make audit logs tamper-evident and define access, retention, export, and deletion policies with the data owner.
7. Threat-model each external model provider's retention, region, and data-use terms before transmitting source content.

## Reporting

Do not include real secrets or personal source documents in a security report. Provide the affected component, reproducible minimal steps, impact, and a proposed remediation through a private channel to the repository owner.
