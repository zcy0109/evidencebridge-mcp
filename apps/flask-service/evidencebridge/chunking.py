from __future__ import annotations

import re
import uuid
from typing import Iterable, List

from .models import Chunk
from .parsers import ParsedUnit


def chunk_units(
    document_id: str,
    modality: str,
    units: Iterable[ParsedUnit],
    max_chars: int = 900,
    overlap_lines: int = 1,
) -> List[Chunk]:
    chunks: List[Chunk] = []
    ordinal = 0
    global_line = 1
    for unit in units:
        lines = [line.strip() for line in unit.text.splitlines() if line.strip()]
        if not lines and unit.text.strip():
            lines = [unit.text.strip()]
        cursor = 0
        while cursor < len(lines):
            selected = []
            selected_chars = 0
            end = cursor
            while end < len(lines):
                candidate = lines[end]
                if selected and selected_chars + len(candidate) + 1 > max_chars:
                    break
                selected.append(candidate)
                selected_chars += len(candidate) + 1
                end += 1
            content = "\n".join(selected)
            chunks.append(
                Chunk(
                    id=str(uuid.uuid4()),
                    document_id=document_id,
                    ordinal=ordinal,
                    content=content,
                    modality=modality,
                    page_number=unit.page_number,
                    start_line=global_line + cursor if unit.page_number is None else None,
                    end_line=global_line + end - 1 if unit.page_number is None else None,
                    start_ms=unit.start_ms,
                    end_ms=unit.end_ms,
                )
            )
            ordinal += 1
            cursor = end if end == len(lines) else max(cursor + 1, end - overlap_lines)
        global_line += len(lines)
    return chunks


def terms(text: str) -> set[str]:
    def normalise(token: str) -> str:
        lowered = token.lower()
        # A deliberately small, inspectable normalisation for English document search.
        # It handles common plural query/source mismatches without pretending to be
        # a semantic embedding model (for example, seminar vs seminars).
        lowered = lowered[:-1] if len(lowered) > 3 and lowered.endswith("s") else lowered
        aliases = {
            "acknowledged": "acknowledge",
            "answered": "answer",
            "attendance": "attend",
            "must": "require",
            "percentage": "percent",
            "required": "require",
            "response": "answer",
            "retained": "retain",
        }
        return aliases.get(lowered, lowered)

    return {
        normalise(token)
        for token in re.findall(r"[\w'-]+", text, flags=re.UNICODE)
        if len(token) > 1 or token.isdigit()
    }
