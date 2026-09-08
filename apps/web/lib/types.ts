export type Locator = {
  page?: number;
  start_line?: number;
  end_line?: number;
  start_ms?: number;
  end_ms?: number;
  chunk_ordinal?: number;
};

export type Evidence = {
  id?: string;
  chunk_id: string;
  document_title?: string;
  document_version?: number;
  filename?: string;
  quote: string;
  locator: Locator;
  modality?: "TEXT" | "PDF" | "IMAGE" | "AUDIO";
  verified?: boolean;
  score?: number;
};

export type DocumentSummary = {
  id: string;
  title: string;
  filename: string;
  version: number;
  modality: string;
  chunk_count: number;
};

export type AuditEvent = {
  id: string;
  event_type: string;
  actor: string;
  payload: Record<string, unknown>;
  created_at: string;
};
