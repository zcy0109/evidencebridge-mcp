from __future__ import annotations

import difflib
import hashlib
import math
import re
import uuid
from typing import Any, Dict, List

from .chunking import terms
from .errors import NotFoundError, ValidationError
from .models import Chunk
from .repository import Repository

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "at",
    "be",
    "do",
    "does",
    "for",
    "from",
    "how",
    "in",
    "is",
    "of",
    "on",
    "the",
    "to",
    "what",
    "when",
    "which",
    "who",
}


def _document_family(title: str) -> str:
    return re.sub(r"(?:[-_\s]+v(?:ersion)?[-_\s]*\d+)$", "", title.casefold())


def _locator(chunk: Chunk) -> Dict[str, Any]:
    locator: Dict[str, Any] = {"chunk_ordinal": chunk.ordinal}
    if chunk.page_number is not None:
        locator["page"] = chunk.page_number
    if chunk.start_line is not None:
        locator["start_line"] = chunk.start_line
        locator["end_line"] = chunk.end_line
    if chunk.start_ms is not None:
        locator["start_ms"] = chunk.start_ms
        locator["end_ms"] = chunk.end_ms
    return locator


def search_documents(
    repository: Repository, workspace_id: str, query: str, limit: int = 5
) -> List[Dict[str, Any]]:
    raw_query_terms = terms(query)
    query_terms = raw_query_terms - STOPWORDS or raw_query_terms
    if not query_terms:
        raise ValidationError("Search query must contain meaningful terms")
    documents = repository.documents(workspace_id)
    explicit_version_match = re.search(r"\b(?:version|v)\s*[-:]?\s*(\d+)\b", query, re.I)
    explicit_version = int(explicit_version_match.group(1)) if explicit_version_match else None
    if explicit_version is not None:
        content_terms = query_terms - {"version", str(explicit_version)}
        if content_terms:
            query_terms = content_terms
    latest_versions: Dict[str, int] = {}
    for document in documents:
        family = _document_family(document.title)
        latest_versions[family] = max(latest_versions.get(family, 0), document.version)
    total_chunks = sum(len(doc.chunks) for doc in documents) or 1
    document_frequency = {
        term: sum(1 for doc in documents for chunk in doc.chunks if term in terms(chunk.content))
        for term in query_terms
    }
    ranked: List[tuple[float, Any, Chunk]] = []
    for document in documents:
        if explicit_version is not None and document.version != explicit_version:
            continue
        for chunk in document.chunks:
            chunk_terms = terms(chunk.content)
            overlap = query_terms & chunk_terms
            if not overlap:
                continue
            idf_score = sum(
                math.log((total_chunks + 1) / (document_frequency[t] + 1)) + 1 for t in overlap
            )
            coverage = len(overlap) / len(query_terms)
            latest_bonus = 0.05 if document.version == latest_versions[_document_family(document.title)] else 0.0
            score = idf_score + 4 * coverage + latest_bonus
            ranked.append((score, document, chunk))
    ranked.sort(key=lambda item: (-item[0], -item[1].version, item[2].ordinal))
    results = []
    for score, document, chunk in ranked[: max(1, min(limit, 20))]:
        evidence = {
            "id": str(uuid.uuid4()),
            "document_id": document.id,
            "chunk_id": chunk.id,
            "document_title": document.title,
            "document_version": document.version,
            "filename": document.filename,
            "quote": chunk.content,
            "locator": _locator(chunk),
            "modality": document.modality,
            "score": round(score, 6),
            "verified": False,
        }
        repository.save_evidence(evidence)
        results.append(evidence)
    repository.audit(
        workspace_id,
        "SEARCH_COMPLETED",
        {
            "query_sha256": hashlib.sha256(query.encode()).hexdigest(),
            "query_length": len(query),
            "result_count": len(results),
        },
    )
    return results


def get_evidence(repository: Repository, chunk_id: str) -> Dict[str, Any]:
    chunk = repository.chunk(chunk_id)
    if chunk is None:
        raise NotFoundError("Evidence chunk was not found")
    document = repository.document(chunk.document_id)
    if document is None:
        raise NotFoundError("Source document was not found")
    result = {
        "id": str(uuid.uuid4()),
        "document_id": document.id,
        "chunk_id": chunk.id,
        "document_title": document.title,
        "document_version": document.version,
        "filename": document.filename,
        "quote": chunk.content,
        "locator": _locator(chunk),
        "modality": document.modality,
        "verified": False,
    }
    repository.save_evidence(result)
    repository.audit(document.workspace_id, "EVIDENCE_OPENED", {"chunk_id": chunk_id})
    return result


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().casefold()


def verify_citation(repository: Repository, chunk_id: str, quote: str) -> Dict[str, Any]:
    chunk = repository.chunk(chunk_id)
    if chunk is None:
        raise NotFoundError("Citation source chunk was not found")
    source = _normalise(chunk.content)
    candidate = _normalise(quote)
    exact = bool(candidate) and candidate in source
    similarity = difflib.SequenceMatcher(None, candidate, source).ratio() if candidate else 0.0
    verified = exact or similarity >= 0.82
    result = {
        "chunk_id": chunk_id,
        "verified": verified,
        "match_type": "exact" if exact else ("high_similarity" if verified else "mismatch"),
        "similarity": round(similarity, 4),
        "source_excerpt": chunk.content,
        "reason": "Quote occurs in the source chunk"
        if exact
        else "Quote differs from the source text",
    }
    document = repository.document(chunk.document_id)
    repository.audit(
        document.workspace_id if document else None,
        "CITATION_VERIFIED",
        {"chunk_id": chunk_id, "verified": verified, "similarity": result["similarity"]},
    )
    return result


def compare_document_versions(
    repository: Repository, older_id: str, newer_id: str
) -> Dict[str, Any]:
    older = repository.document(older_id)
    newer = repository.document(newer_id)
    if older is None or newer is None:
        raise NotFoundError("One or both document versions were not found")
    older_lines = "\n".join(chunk.content for chunk in older.chunks).splitlines()
    newer_lines = "\n".join(chunk.content for chunk in newer.chunks).splitlines()
    diff = list(
        difflib.unified_diff(
            older_lines,
            newer_lines,
            fromfile=f"{older.title} v{older.version}",
            tofile=f"{newer.title} v{newer.version}",
            lineterm="",
        )
    )
    changes = [
        line for line in diff if line.startswith(("+", "-")) and not line.startswith(("+++", "---"))
    ]
    result = {
        "older": older.to_dict(),
        "newer": newer.to_dict(),
        "diff": diff[:400],
        "change_count": len(changes),
        "truncated": len(diff) > 400,
    }
    repository.audit(
        older.workspace_id,
        "VERSIONS_COMPARED",
        {"older_id": older_id, "newer_id": newer_id, "change_count": len(changes)},
    )
    return result
