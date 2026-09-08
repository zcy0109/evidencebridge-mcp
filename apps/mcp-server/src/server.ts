import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createHandlers, schemas, toMcpResult } from "./tools.js";

export function createServer() {
  const server = new McpServer({ name: "evidencebridge-mcp", version: "0.1.0" });
  const handlers = createHandlers();

  server.registerTool(
    "search_documents",
    { description: "Search untrusted workspace documents and return source-grounded evidence with exact locators.", inputSchema: schemas.search_documents },
    async (input) => toMcpResult(await handlers.search_documents(input)),
  );
  server.registerTool(
    "get_evidence",
    { description: "Retrieve one exact evidence chunk and its document/page/line/time locator.", inputSchema: schemas.get_evidence },
    async (input) => toMcpResult(await handlers.get_evidence(input)),
  );
  server.registerTool(
    "verify_citation",
    { description: "Verify that a proposed quotation is present in the referenced source chunk.", inputSchema: schemas.verify_citation },
    async (input) => toMcpResult(await handlers.verify_citation(input)),
  );
  server.registerTool(
    "compare_document_versions",
    { description: "Produce a bounded unified diff between two stored document versions.", inputSchema: schemas.compare_document_versions },
    async (input) => toMcpResult(await handlers.compare_document_versions(input)),
  );
  server.registerTool(
    "request_human_review",
    { description: "Create an auditable review task when evidence is absent, conflicting, low-confidence, or high-risk.", inputSchema: schemas.request_human_review },
    async (input) => toMcpResult(await handlers.request_human_review(input)),
  );

  return server;
}
