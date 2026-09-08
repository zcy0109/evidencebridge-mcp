import { z } from "zod";

import { FlaskEvidenceClient, type JsonObject } from "./flask-client.js";

export const schemas = {
  search_documents: {
    workspace_id: z.string().uuid().describe("Workspace UUID that limits the search boundary"),
    query: z.string().min(2).max(2000).describe("Natural-language evidence query"),
    limit: z.number().int().min(1).max(20).optional().default(5),
  },
  get_evidence: {
    chunk_id: z.string().uuid().describe("Exact source chunk UUID returned by search_documents"),
  },
  verify_citation: {
    chunk_id: z.string().uuid(),
    quote: z.string().min(1).max(20_000).describe("Proposed verbatim quotation to validate against the source"),
  },
  compare_document_versions: {
    older_document_id: z.string().uuid(),
    newer_document_id: z.string().uuid(),
  },
  request_human_review: {
    workspace_id: z.string().uuid(),
    reason: z.string().min(5).max(1000),
    risk_level: z.enum(["low", "medium", "high"]),
    payload: z.record(z.string(), z.unknown()).optional(),
  },
} as const;

export function createHandlers(client = new FlaskEvidenceClient()) {
  return {
    search_documents: (input: { workspace_id: string; query: string; limit?: number }) => client.searchDocuments(input),
    get_evidence: (input: { chunk_id: string }) => client.getEvidence(input),
    verify_citation: (input: { chunk_id: string; quote: string }) => client.verifyCitation(input),
    compare_document_versions: (input: { older_document_id: string; newer_document_id: string }) => client.compareDocumentVersions(input),
    request_human_review: (input: { workspace_id: string; reason: string; risk_level: "low" | "medium" | "high"; payload?: JsonObject }) => client.requestHumanReview(input),
  };
}

export function toMcpResult(data: JsonObject) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}
