const baseUrl = process.env.FLASK_SERVICE_URL ?? "http://127.0.0.1:5001";

export async function flaskFetch(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        ...(process.env.EVIDENCEBRIDGE_API_TOKEN
          ? { Authorization: `Bearer ${process.env.EVIDENCEBRIDGE_API_TOKEN}` }
          : {}),
        ...init.headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function proxyJson(path: string, init: RequestInit = {}) {
  try {
    const response = await flaskFetch(path, init);
    return new Response(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evidence service unavailable";
    return Response.json({ error: { code: "service_unavailable", message } }, { status: 503 });
  }
}
