import { flaskFetch, proxyJson } from "@/lib/flask";

export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspace_id") ?? "";
  return proxyJson(`/api/documents?workspace_id=${encodeURIComponent(workspaceId)}`);
}

export async function POST(request: Request) {
  try {
    const response = await flaskFetch("/api/documents", { method: "POST", body: await request.formData() });
    return new Response(await response.text(), { status: response.status, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return Response.json({ error: { message: error instanceof Error ? error.message : "Upload failed" } }, { status: 503 });
  }
}
