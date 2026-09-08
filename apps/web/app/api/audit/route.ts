import { proxyJson } from "@/lib/flask";

export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspace_id") ?? "";
  return proxyJson(`/api/audit?workspace_id=${encodeURIComponent(workspaceId)}`);
}
