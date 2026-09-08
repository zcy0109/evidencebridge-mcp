"use client";

import { useEffect, useState } from "react";
import type { AuditEvent } from "@/lib/types";

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const workspaceId = localStorage.getItem("evidencebridge-workspace") ?? "";
    fetch(`/api/audit?workspace_id=${encodeURIComponent(workspaceId)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Audit service unavailable")))
      .then((data) => setEvents(data.events))
      .catch((reason) => setError(reason.message));
  }, []);
  return <main className="audit-page"><header><p className="eyebrow">IMMUTABLE-STYLE APPLICATION LOG</p><h1>Audit trail</h1><p>Every ingestion, retrieval, citation decision, version comparison, and human-review route is recorded with bounded metadata.</p></header>{error && <p className="error">{error}</p>}<div className="audit-table"><div className="audit-row audit-head"><span>Time</span><span>Event</span><span>Actor</span><span>Payload</span></div>{events.map((event) => <div className="audit-row" key={event.id}><time>{new Date(event.created_at).toLocaleString()}</time><b>{event.event_type.replaceAll("_", " ")}</b><span>{event.actor}</span><code>{JSON.stringify(event.payload)}</code></div>)}</div>{events.length === 0 && !error && <p className="empty">No events recorded in this workspace yet.</p>}</main>;
}
