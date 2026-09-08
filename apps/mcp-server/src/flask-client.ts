export type JsonObject = Record<string, unknown>;

export class FlaskEvidenceClient {
  constructor(
    private readonly baseUrl = process.env.FLASK_SERVICE_URL ?? "http://127.0.0.1:5001",
    private readonly token = process.env.EVIDENCEBRIDGE_API_TOKEN,
    private readonly timeoutMs = Number(process.env.REQUEST_TIMEOUT_SECONDS ?? "15") * 1000,
  ) {}

  private async request(path: string, init: RequestInit = {}): Promise<JsonObject> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...init.headers,
        },
      });
      const data = (await response.json()) as JsonObject;
      if (!response.ok) {
        const error = data.error as JsonObject | undefined;
        throw new Error(typeof error?.message === "string" ? error.message : `Evidence service returned ${response.status}`);
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  searchDocuments(input: { workspace_id: string; query: string; limit?: number }) {
    if (process.env.MCP_TEST_FIXTURE === "true") {
      return Promise.resolve({
        results: [
          {
            chunk_id: "00000000-0000-4000-8000-000000000099",
            quote: `Evidence for ${input.query}`,
            locator: { page: 1 },
            verified: false,
          },
        ],
      });
    }
    return this.request("/api/search", { method: "POST", body: JSON.stringify(input) });
  }

  getEvidence(input: { chunk_id: string }) {
    if (process.env.MCP_TEST_FIXTURE === "true") {
      return Promise.resolve({ chunk_id: input.chunk_id, quote: "Fixture evidence", locator: { page: 1 }, verified: false });
    }
    return this.request(`/api/evidence/${encodeURIComponent(input.chunk_id)}`);
  }

  verifyCitation(input: { chunk_id: string; quote: string }) {
    if (process.env.MCP_TEST_FIXTURE === "true") {
      return Promise.resolve({ chunk_id: input.chunk_id, verified: input.quote === "Fixture evidence", match_type: "exact" });
    }
    return this.request("/api/verify", { method: "POST", body: JSON.stringify(input) });
  }

  compareDocumentVersions(input: { older_document_id: string; newer_document_id: string }) {
    if (process.env.MCP_TEST_FIXTURE === "true") {
      return Promise.resolve({ ...input, change_count: 2, diff: ["-old", "+new"] });
    }
    return this.request("/api/compare", { method: "POST", body: JSON.stringify(input) });
  }

  requestHumanReview(input: { workspace_id: string; reason: string; risk_level: "low" | "medium" | "high"; payload?: JsonObject }) {
    if (process.env.MCP_TEST_FIXTURE === "true") {
      return Promise.resolve({ id: "00000000-0000-4000-8000-000000000088", ...input, status: "PENDING" });
    }
    return this.request("/api/reviews", { method: "POST", body: JSON.stringify(input) });
  }
}
