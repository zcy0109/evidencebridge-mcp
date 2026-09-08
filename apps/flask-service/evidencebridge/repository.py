from __future__ import annotations

import json
import os
import uuid
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from .models import Chunk, Document, now_iso


class Repository(ABC):
    @abstractmethod
    def create_workspace(self, name: str) -> Dict[str, Any]: ...

    @abstractmethod
    def save_document(self, document: Document) -> None: ...

    @abstractmethod
    def documents(self, workspace_id: str) -> List[Document]: ...

    @abstractmethod
    def document(self, document_id: str) -> Optional[Document]: ...

    @abstractmethod
    def chunk(self, chunk_id: str) -> Optional[Chunk]: ...

    @abstractmethod
    def save_evidence(self, evidence: Dict[str, Any]) -> None: ...

    @abstractmethod
    def record_tool_call(
        self,
        tool_name: str,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        latency_ms: int,
    ) -> None: ...

    @abstractmethod
    def save_turn(
        self,
        workspace_id: str,
        conversation_id: Optional[str],
        title: str,
        user_content: str,
        assistant_content: str,
    ) -> str: ...

    @abstractmethod
    def create_review(
        self, workspace_id: str, reason: str, risk: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]: ...

    @abstractmethod
    def audit(
        self, workspace_id: Optional[str], event_type: str, payload: Dict[str, Any]
    ) -> None: ...

    @abstractmethod
    def audit_events(self, workspace_id: Optional[str]) -> List[Dict[str, Any]]: ...


class MemoryRepository(Repository):
    def __init__(self) -> None:
        self.workspaces: Dict[str, Dict[str, Any]] = {}
        self._documents: Dict[str, Document] = {}
        self._chunks: Dict[str, Chunk] = {}
        self.reviews: List[Dict[str, Any]] = []
        self.evidence: Dict[str, Dict[str, Any]] = {}
        self.events: List[Dict[str, Any]] = []
        self.tool_calls: List[Dict[str, Any]] = []
        self.conversations: Dict[str, Dict[str, Any]] = {}
        self.messages: List[Dict[str, Any]] = []

    def create_workspace(self, name: str) -> Dict[str, Any]:
        item = {"id": str(uuid.uuid4()), "name": name, "created_at": now_iso()}
        self.workspaces[item["id"]] = item
        return item

    def save_document(self, document: Document) -> None:
        self._documents[document.id] = document
        self._chunks.update({chunk.id: chunk for chunk in document.chunks})

    def documents(self, workspace_id: str) -> List[Document]:
        return [doc for doc in self._documents.values() if doc.workspace_id == workspace_id]

    def document(self, document_id: str) -> Optional[Document]:
        return self._documents.get(document_id)

    def chunk(self, chunk_id: str) -> Optional[Chunk]:
        return self._chunks.get(chunk_id)

    def save_evidence(self, evidence: Dict[str, Any]) -> None:
        self.evidence[evidence["id"]] = evidence

    def record_tool_call(
        self,
        tool_name: str,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        latency_ms: int,
    ) -> None:
        self.tool_calls.append(
            {
                "id": str(uuid.uuid4()),
                "tool_name": tool_name,
                "input": input_data,
                "output": output_data,
                "status": "SUCCESS",
                "latency_ms": latency_ms,
            }
        )

    def save_turn(
        self,
        workspace_id: str,
        conversation_id: Optional[str],
        title: str,
        user_content: str,
        assistant_content: str,
    ) -> str:
        resolved_id = conversation_id or str(uuid.uuid4())
        self.conversations.setdefault(
            resolved_id,
            {"id": resolved_id, "workspace_id": workspace_id, "title": title},
        )
        for role, content in (("user", user_content), ("assistant", assistant_content)):
            self.messages.append(
                {
                    "id": str(uuid.uuid4()),
                    "conversation_id": resolved_id,
                    "role": role,
                    "content": content,
                }
            )
        return resolved_id

    def create_review(
        self, workspace_id: str, reason: str, risk: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        item = {
            "id": str(uuid.uuid4()),
            "workspace_id": workspace_id,
            "reason": reason,
            "risk_level": risk,
            "payload": payload,
            "status": "PENDING",
            "created_at": now_iso(),
        }
        self.reviews.append(item)
        return item

    def audit(self, workspace_id: Optional[str], event_type: str, payload: Dict[str, Any]) -> None:
        self.events.append(
            {
                "id": str(uuid.uuid4()),
                "workspace_id": workspace_id,
                "event_type": event_type,
                "actor": "service",
                "payload": payload,
                "created_at": now_iso(),
            }
        )

    def audit_events(self, workspace_id: Optional[str]) -> List[Dict[str, Any]]:
        events = (
            self.events
            if not workspace_id
            else [event for event in self.events if event["workspace_id"] == workspace_id]
        )
        return list(reversed(events[-200:]))


class PostgresRepository(Repository):
    """Uses the PostgreSQL tables created by the checked-in Prisma migration."""

    def __init__(self, database_url: str) -> None:
        import psycopg

        self._psycopg = psycopg
        self.database_url = database_url.replace("?schema=public", "")

    def _connect(self):
        return self._psycopg.connect(self.database_url)

    def create_workspace(self, name: str) -> Dict[str, Any]:
        item = {"id": str(uuid.uuid4()), "name": name, "created_at": now_iso()}
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute('INSERT INTO "workspaces" (id, name) VALUES (%s, %s)', (item["id"], name))
        return item

    def save_document(self, document: Document) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                'INSERT INTO "documents" (id, workspace_id, title, filename, version, modality, sha256, mime_type) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)',
                (
                    document.id,
                    document.workspace_id,
                    document.title,
                    document.filename,
                    document.version,
                    document.modality,
                    document.sha256,
                    document.mime_type,
                ),
            )
            for chunk in document.chunks:
                cur.execute(
                    'INSERT INTO "document_chunks" (id, document_id, ordinal, content, page_number, start_line, end_line, start_ms, end_ms, token_count, search_text) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                    (
                        chunk.id,
                        document.id,
                        chunk.ordinal,
                        chunk.content,
                        chunk.page_number,
                        chunk.start_line,
                        chunk.end_line,
                        chunk.start_ms,
                        chunk.end_ms,
                        len(chunk.content.split()),
                        chunk.content.lower(),
                    ),
                )

    @staticmethod
    def _row_to_document(row: Any, chunks: List[Chunk]) -> Document:
        return Document(
            id=str(row[0]),
            workspace_id=str(row[1]),
            title=row[2],
            filename=row[3],
            version=row[4],
            modality=row[5],
            sha256=row[6],
            mime_type=row[7],
            created_at=row[8].isoformat(),
            chunks=chunks,
        )

    def _chunks_for(self, conn: Any, document_id: str) -> List[Chunk]:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT id, document_id, ordinal, content, page_number, start_line, end_line, start_ms, end_ms FROM "document_chunks" WHERE document_id=%s ORDER BY ordinal',
                (document_id,),
            )
            return [
                Chunk(
                    id=str(r[0]),
                    document_id=str(r[1]),
                    ordinal=r[2],
                    content=r[3],
                    modality="TEXT",
                    page_number=r[4],
                    start_line=r[5],
                    end_line=r[6],
                    start_ms=r[7],
                    end_ms=r[8],
                )
                for r in cur.fetchall()
            ]

    def documents(self, workspace_id: str) -> List[Document]:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                'SELECT id, workspace_id, title, filename, version, modality::text, sha256, mime_type, created_at FROM "documents" WHERE workspace_id=%s ORDER BY created_at',
                (workspace_id,),
            )
            rows = cur.fetchall()
            return [self._row_to_document(row, self._chunks_for(conn, str(row[0]))) for row in rows]

    def document(self, document_id: str) -> Optional[Document]:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                'SELECT id, workspace_id, title, filename, version, modality::text, sha256, mime_type, created_at FROM "documents" WHERE id=%s',
                (document_id,),
            )
            row = cur.fetchone()
            return (
                None
                if row is None
                else self._row_to_document(row, self._chunks_for(conn, document_id))
            )

    def chunk(self, chunk_id: str) -> Optional[Chunk]:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                'SELECT c.id,c.document_id,c.ordinal,c.content,c.page_number,c.start_line,c.end_line,c.start_ms,c.end_ms,d.modality::text FROM "document_chunks" c JOIN "documents" d ON d.id=c.document_id WHERE c.id=%s',
                (chunk_id,),
            )
            row = cur.fetchone()
            return (
                None
                if row is None
                else Chunk(
                    id=str(row[0]),
                    document_id=str(row[1]),
                    ordinal=row[2],
                    content=row[3],
                    page_number=row[4],
                    start_line=row[5],
                    end_line=row[6],
                    start_ms=row[7],
                    end_ms=row[8],
                    modality=row[9],
                )
            )

    def save_evidence(self, evidence: Dict[str, Any]) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                'INSERT INTO "evidence" (id, document_id, chunk_id, quote, locator, modality, verified) VALUES (%s,%s,%s,%s,%s,%s,%s)',
                (
                    evidence["id"],
                    evidence["document_id"],
                    evidence["chunk_id"],
                    evidence["quote"],
                    json.dumps(evidence["locator"]),
                    evidence["modality"],
                    evidence["verified"],
                ),
            )

    def record_tool_call(
        self,
        tool_name: str,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        latency_ms: int,
    ) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                'INSERT INTO "tool_calls" (id, tool_name, input, output, status, latency_ms) VALUES (%s,%s,%s,%s,%s,%s)',
                (
                    str(uuid.uuid4()),
                    tool_name,
                    json.dumps(input_data),
                    json.dumps(output_data),
                    "SUCCESS",
                    latency_ms,
                ),
            )

    def save_turn(
        self,
        workspace_id: str,
        conversation_id: Optional[str],
        title: str,
        user_content: str,
        assistant_content: str,
    ) -> str:
        resolved_id = conversation_id or str(uuid.uuid4())
        with self._connect() as conn, conn.cursor() as cur:
            if conversation_id is None:
                cur.execute(
                    'INSERT INTO "conversations" (id, workspace_id, title) VALUES (%s,%s,%s)',
                    (resolved_id, workspace_id, title),
                )
            for role, content in (("user", user_content), ("assistant", assistant_content)):
                cur.execute(
                    'INSERT INTO "messages" (id, conversation_id, role, content) VALUES (%s,%s,%s,%s)',
                    (str(uuid.uuid4()), resolved_id, role, content),
                )
        return resolved_id

    def create_review(
        self, workspace_id: str, reason: str, risk: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        item = {
            "id": str(uuid.uuid4()),
            "workspace_id": workspace_id,
            "reason": reason,
            "risk_level": risk,
            "payload": payload,
            "status": "PENDING",
            "created_at": now_iso(),
        }
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                'INSERT INTO "human_reviews" (id, workspace_id, reason, payload, risk_level) VALUES (%s,%s,%s,%s,%s)',
                (item["id"], workspace_id, reason, json.dumps(payload), risk),
            )
        return item

    def audit(self, workspace_id: Optional[str], event_type: str, payload: Dict[str, Any]) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                'INSERT INTO "audit_events" (id, workspace_id, event_type, actor, payload) VALUES (%s,%s,%s,%s,%s)',
                (str(uuid.uuid4()), workspace_id, event_type, "service", json.dumps(payload)),
            )

    def audit_events(self, workspace_id: Optional[str]) -> List[Dict[str, Any]]:
        query = 'SELECT id,workspace_id,event_type,actor,payload,created_at FROM "audit_events"'
        params: tuple[Any, ...] = ()
        if workspace_id:
            query += " WHERE workspace_id=%s"
            params = (workspace_id,)
        query += " ORDER BY created_at DESC LIMIT 200"
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(query, params)
            return [
                {
                    "id": str(r[0]),
                    "workspace_id": str(r[1]) if r[1] else None,
                    "event_type": r[2],
                    "actor": r[3],
                    "payload": r[4],
                    "created_at": r[5].isoformat(),
                }
                for r in cur.fetchall()
            ]


def repository_from_env() -> Repository:
    database_url = os.getenv("DATABASE_URL")
    return PostgresRepository(database_url) if database_url else MemoryRepository()
