from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Chunk:
    id: str
    document_id: str
    ordinal: int
    content: str
    modality: str
    page_number: Optional[int] = None
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    start_ms: Optional[int] = None
    end_ms: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Document:
    id: str
    workspace_id: str
    title: str
    filename: str
    version: int
    modality: str
    mime_type: str
    sha256: str
    chunks: List[Chunk] = field(default_factory=list)
    created_at: str = field(default_factory=now_iso)

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result["chunk_count"] = len(self.chunks)
        result.pop("chunks")
        return result
