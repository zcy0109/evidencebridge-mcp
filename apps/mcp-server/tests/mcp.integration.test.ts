import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("stdio MCP server", () => {
  it("lists and executes real tools through the official MCP SDK", async () => {
    const packageRoot = fileURLToPath(new URL("../", import.meta.url));
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [`${packageRoot}dist/index.js`],
      env: { ...process.env, MCP_TEST_FIXTURE: "true", EVIDENCEBRIDGE_API_TOKEN: "" } as Record<string, string>,
    });
    const client = new Client({ name: "integration-test", version: "0.1.0" });
    await client.connect(transport);
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(["search_documents", "get_evidence", "verify_citation", "compare_document_versions", "request_human_review"]));
    const result = await client.callTool({ name: "search_documents", arguments: { workspace_id: "00000000-0000-4000-8000-000000000001", query: "attendance requirement", limit: 3 } });
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result.structuredContent)).toContain("attendance requirement");
    const evidence = await client.callTool({ name: "get_evidence", arguments: { chunk_id: "00000000-0000-4000-8000-000000000099" } });
    expect(evidence.isError).not.toBe(true);
    const verification = await client.callTool({ name: "verify_citation", arguments: { chunk_id: "00000000-0000-4000-8000-000000000099", quote: "Fixture evidence" } });
    expect(JSON.stringify(verification.structuredContent)).toContain('"verified":true');
    const comparison = await client.callTool({ name: "compare_document_versions", arguments: { older_document_id: "00000000-0000-4000-8000-000000000010", newer_document_id: "00000000-0000-4000-8000-000000000011" } });
    expect(JSON.stringify(comparison.structuredContent)).toContain('"change_count":2');
    const review = await client.callTool({ name: "request_human_review", arguments: { workspace_id: "00000000-0000-4000-8000-000000000001", reason: "Conflicting fixture evidence", risk_level: "high" } });
    expect(JSON.stringify(review.structuredContent)).toContain('"status":"PENDING"');
    await client.close();
  });
});
