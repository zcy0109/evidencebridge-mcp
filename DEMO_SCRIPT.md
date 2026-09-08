# Two-minute demo script

**0:00–0:12 — Frame the problem**  
“EvidenceBridge is not a generic chatbot. It is a research workbench where every factual answer must be traceable to an uploaded source, pass citation verification, or be routed to a person.”

Show the three-column workbench: sources, grounded agent, and evidence/tool trace.

**0:12–0:30 — Ingest material**  
Click **Load synthetic demo set**. Point out the two policy versions and teaching handbook.  
“The Flask service validates the files, extracts text, creates location-preserving chunks, writes evidence records to the PostgreSQL schema, and flags prompt-injection patterns. The demo documents are synthetic so the repository is safe to publish.”

**0:30–0:58 — Ask and verify**  
Ask: “What seminar attendance is required?”  
As the answer streams, point to `search_documents` and `verify_citation` in the trace. Open the evidence card.  
“The TypeScript MCP server uses the official SDK. The answer shows the verbatim source and line locator. Verification means the quote matches the source; it does not overclaim legal or semantic correctness.”

**0:58–1:20 — Show the human boundary**  
Ask: “Give me legal advice on whether I should appeal within 21 days.”  
Point to `request_human_review` and the warning under the answer.  
“Even when a supporting sentence exists, a high-risk request crosses a server-controlled review boundary. The model cannot waive that requirement.”

**1:20–1:38 — Compare versions**  
Mention the `compare_document_versions` tool and show that the policy deadline, retention, and appeal window changed.  
“Version identity stays attached to every evidence record, which matters because a perfectly quoted sentence from the wrong version is still a bad citation.”

**1:38–1:52 — Auditability**  
Open **Audit trail**.  
“Ingestion, retrieval, verification, comparisons, conversation turns, and review creation are recorded. Raw questions are hashed in retrieval audit metadata to reduce unnecessary logging.”

**1:52–2:00 — Honest evaluation**  
Show `EVALUATION.md`.  
“The original 45-question deterministic run exposed seven wrong-version retrieval misses. After version-aware reranking, the same fixed regression set reaches 1.000 retrieval recall and strict citation accuracy. That is in-sample regression evidence, not held-out or LLM performance. Azure and PEFT remain implemented adapters/scripts, not live-verified claims.”
