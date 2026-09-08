import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export async function withMcpClient<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const configured = process.env.MCP_SERVER_PATH;
  const serverPath = configured ?? path.resolve(process.cwd(), "../mcp-server/dist/index.js");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: {
      ...process.env,
      FLASK_SERVICE_URL: process.env.FLASK_SERVICE_URL ?? "http://127.0.0.1:5001",
      EVIDENCEBRIDGE_API_TOKEN: process.env.EVIDENCEBRIDGE_API_TOKEN ?? "",
    } as Record<string, string>,
  });
  const client = new Client({ name: "evidencebridge-web-agent", version: "0.1.0" });
  await client.connect(transport);
  try {
    return await run(client);
  } finally {
    await client.close();
  }
}

export async function callMcpTool(name: string, args: Record<string, unknown>) {
  return withMcpClient(async (client) => {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) throw new Error(`MCP tool ${name} failed`);
    return result.structuredContent as Record<string, unknown>;
  });
}
