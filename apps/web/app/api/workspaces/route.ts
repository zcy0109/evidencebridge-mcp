import { proxyJson } from "@/lib/flask";

export async function POST(request: Request) {
  return proxyJson("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: await request.text() });
}
