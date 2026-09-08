"use client";

import { useChat } from "@ai-sdk/react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import type { DocumentSummary, Evidence } from "@/lib/types";

type Trace = { tool: string; status: string; result?: Record<string, unknown> };

function locator(evidence: Evidence) {
  if (evidence.locator.page) return `p. ${evidence.locator.page}`;
  if (evidence.locator.start_line) return `ll. ${evidence.locator.start_line}–${evidence.locator.end_line}`;
  if (evidence.locator.start_ms !== undefined) return `${Math.round(evidence.locator.start_ms / 1000)}s`;
  return `chunk ${evidence.locator.chunk_ordinal ?? 0}`;
}

export function Workbench() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [notice, setNotice] = useState("Preparing a private local workspace…");
  const [loadingDemo, setLoadingDemo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { messages, input, handleInputChange, handleSubmit, status, data, setInput } = useChat({ api: "/api/chat", body: { workspaceId } });

  async function refreshDocuments(id = workspaceId) {
    if (!id) return;
    const response = await fetch(`/api/documents?workspace_id=${encodeURIComponent(id)}`);
    if (response.ok) setDocuments((await response.json()).documents);
  }

  useEffect(() => {
    const existing = localStorage.getItem("evidencebridge-workspace");
    if (existing) {
      setWorkspaceId(existing);
      setNotice("Workspace ready");
      void refreshDocuments(existing);
      return;
    }
    void fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "EvidenceBridge demo" }) })
      .then(async (response) => {
        if (!response.ok) throw new Error("Start the Flask service to create a workspace");
        return response.json();
      })
      .then((workspace) => {
        localStorage.setItem("evidencebridge-workspace", workspace.id);
        setWorkspaceId(workspace.id);
        setNotice("Workspace ready — load the synthetic demo materials");
      })
      .catch((error) => setNotice(error.message));
  }, []);

  useEffect(() => {
    if (!data) return;
    const nextTraces = data.flatMap((item) => {
      if (item && typeof item === "object" && !Array.isArray(item) && "tool" in item) {
        return [item as unknown as Trace];
      }
      return [];
    });
    setTraces(nextTraces);
    const verifiedChunks = new Set(
      nextTraces
        .filter((trace) => trace.tool === "verify_citation" && trace.result?.verified === true)
        .map((trace) => String(trace.result?.chunk_id ?? "")),
    );
    const found: Evidence[] = [];
    for (const trace of nextTraces) {
      const results = trace.result?.results;
      if (Array.isArray(results)) {
        found.push(...(results as Evidence[]).map((item) => ({ ...item, verified: verifiedChunks.has(item.chunk_id) })));
      }
    }
    setEvidence(found);
  }, [data]);

  const busy = status === "submitted" || status === "streaming";
  const verifiedCount = useMemo(() => evidence.filter((item) => item.verified).length, [evidence]);

  async function loadDemo() {
    if (!workspaceId) return;
    setLoadingDemo(true);
    const response = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId }) });
    setLoadingDemo(false);
    if (response.ok) {
      setNotice("Three synthetic, clearly labelled demo documents ingested");
      await refreshDocuments();
    } else setNotice("Demo load failed — check the service log");
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !workspaceId) return;
    const form = new FormData(event.currentTarget);
    form.set("workspace_id", workspaceId);
    form.set("file", file);
    const response = await fetch("/api/documents", { method: "POST", body: form });
    setNotice(response.ok ? `${file.name} ingested and chunked` : "Upload rejected; inspect file type, size, or parser output");
    if (response.ok) {
      event.currentTarget.reset();
      await refreshDocuments();
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div><p className="eyebrow">TRACEABLE RESEARCH WORKSPACE</p><h1>Answers that can show their work.</h1><p>Evidence-first retrieval, citation verification, MCP tool calls, and explicit human boundaries for policy, law, and teaching materials.</p></div>
        <div className="hero-metrics"><div><strong>{documents.length}</strong><span>documents</span></div><div><strong>{evidence.length}</strong><span>evidence hits</span></div><div><strong>{verifiedCount}</strong><span>verified</span></div></div>
      </section>

      <div className="workspace-grid">
        <aside className="panel sources-panel">
          <div className="panel-heading"><div><span className="kicker">01 / SOURCES</span><h2>Evidence library</h2></div><span className="count">{documents.length}</span></div>
          <button className="demo-button" onClick={loadDemo} disabled={!workspaceId || loadingDemo}>{loadingDemo ? "Loading…" : "Load synthetic demo set"}</button>
          <div className="document-list">
            {documents.map((doc) => <article className="document" key={doc.id}><span className={`file-icon ${doc.modality.toLowerCase()}`}>{doc.modality.slice(0, 3)}</span><div><b>{doc.title}</b><small>v{doc.version} · {doc.chunk_count} chunks</small></div></article>)}
            {documents.length === 0 && <p className="empty">No sources yet. Load the demo set or upload your own UTF-8 text, Markdown, or PDF.</p>}
          </div>
          <form className="upload" onSubmit={upload}>
            <label>Upload material<input ref={fileRef} name="file" type="file" accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.wav,.mp3" required /></label>
            <input name="title" placeholder="Document title" required maxLength={200} />
            <div className="row"><input name="version" type="number" min="1" defaultValue="1" /><button type="submit">Ingest</button></div>
            <small>Images/audio require a transcript adapter; no content is silently invented.</small>
          </form>
        </aside>

        <section className="panel chat-panel">
          <div className="panel-heading"><div><span className="kicker">02 / ASK</span><h2>Grounded agent</h2></div><span className="live"><i /> {busy ? "working" : "ready"}</span></div>
          <div className="messages">
            {messages.length === 0 && <div className="welcome"><span>EB</span><h3>Ask a question with a verifiable answer</h3><p>The agent searches via MCP, verifies the quotation, and escalates when evidence is absent or the decision is high risk.</p><div className="prompts">{["When do applications close?", "What changed between policy versions?", "What seminar attendance is required?"].map((prompt) => <button key={prompt} onClick={() => setInput(prompt)}>{prompt}</button>)}</div></div>}
            {messages.map((message) => <article key={message.id} className={`message ${message.role}`}><span className="avatar">{message.role === "user" ? "YOU" : "EB"}</span><div><small>{message.role === "user" ? "Question" : "EvidenceBridge"}</small><p>{message.content}</p>{message.toolInvocations?.map((call) => <div className="inline-tool" key={call.toolCallId}><b>{call.toolName}</b><span>{"result" in call ? "completed" : "running"}</span></div>)}</div></article>)}
          </div>
          <form className="composer" onSubmit={handleSubmit}><textarea value={input} onChange={handleInputChange} placeholder="Ask only what the sources can support…" rows={3} disabled={!workspaceId || busy} /><div><span>{notice}</span><button disabled={!input.trim() || !workspaceId || busy}>{busy ? "Tracing…" : "Ask with evidence"}</button></div></form>
        </section>

        <aside className="panel evidence-panel">
          <div className="panel-heading"><div><span className="kicker">03 / VERIFY</span><h2>Evidence & trace</h2></div><span className="count verified">{verifiedCount}</span></div>
          <div className="trace-list">{traces.map((trace, index) => <div className="trace" key={`${trace.tool}-${index}`}><span>{index + 1}</span><div><b>{trace.tool}</b><small>{trace.status}</small></div><i>✓</i></div>)}{traces.length === 0 && <p className="empty">Tool calls will appear here in execution order.</p>}</div>
          <div className="evidence-list">{evidence.slice(0, 4).map((item) => <article className="evidence-card" key={item.id ?? item.chunk_id}><div><span>{item.modality ?? "TEXT"}</span><b>{item.verified ? "VERIFIED" : "RETRIEVED"}</b></div><blockquote>{item.quote}</blockquote><footer><span>{item.document_title ?? item.filename}</span><strong>{locator(item)}</strong></footer></article>)}</div>
        </aside>
      </div>
    </main>
  );
}
