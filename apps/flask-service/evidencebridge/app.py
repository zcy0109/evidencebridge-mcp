from __future__ import annotations

import hashlib
import logging
import mimetypes
import os
import time
import uuid
from collections import defaultdict, deque
from typing import Any, Dict, Optional

from flask import Flask, jsonify, request
from werkzeug.exceptions import RequestEntityTooLarge

from .chunking import chunk_units
from .errors import EvidenceBridgeError, RateLimitError, ValidationError
from .models import Document
from .parsers import parse_document
from .repository import MemoryRepository, Repository, repository_from_env
from .retrieval import compare_document_versions, get_evidence, search_documents, verify_citation
from .security import detect_prompt_injection, max_upload_bytes, require_api_token, safe_filename

LOGGER = logging.getLogger("evidencebridge")


def _json() -> Dict[str, Any]:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise ValidationError("Expected a JSON object")
    return payload


def _required(payload: Dict[str, Any], key: str, limit: int = 5000) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"'{key}' is required")
    if len(value) > limit:
        raise ValidationError(f"'{key}' exceeds the length limit")
    return value.strip()


def create_app(
    config: Optional[Dict[str, Any]] = None, repository: Optional[Repository] = None
) -> Flask:
    app = Flask(__name__)
    app.config.update(
        MAX_CONTENT_LENGTH=max_upload_bytes(),
        JSON_SORT_KEYS=False,
        SERVICE_TOKEN=os.getenv("EVIDENCEBRIDGE_API_TOKEN"),
    )
    if config:
        app.config.update(config)
    repo = repository or repository_from_env()
    app.extensions["repository"] = repo
    requests_by_client: Dict[str, deque[float]] = defaultdict(deque)

    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    @app.before_request
    def authenticate() -> None:
        client = request.remote_addr or "unknown"
        now = time.monotonic()
        history = requests_by_client[client]
        while history and history[0] < now - 60:
            history.popleft()
        if len(history) >= int(os.getenv("RATE_LIMIT_PER_MINUTE", "120")):
            raise RateLimitError("Request rate limit exceeded")
        history.append(now)
        if request.path != "/health":
            require_api_token(request, app.config.get("SERVICE_TOKEN"))

    @app.after_request
    def secure_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/health")
    def health():
        return jsonify(
            {
                "status": "ok",
                "repository": "memory" if isinstance(repo, MemoryRepository) else "postgresql",
                "version": "0.1.0",
            }
        )

    @app.post("/api/workspaces")
    def create_workspace():
        payload = _json()
        workspace = repo.create_workspace(_required(payload, "name", 120))
        repo.audit(workspace["id"], "WORKSPACE_CREATED", {"name": workspace["name"]})
        return jsonify(workspace), 201

    @app.get("/api/documents")
    def list_documents():
        workspace_id = request.args.get("workspace_id", "")
        return jsonify({"documents": [doc.to_dict() for doc in repo.documents(workspace_id)]})

    @app.post("/api/documents")
    def upload_document():
        workspace_id = request.form.get("workspace_id", "").strip()
        title = request.form.get("title", "").strip()
        version_raw = request.form.get("version", "1")
        uploaded = request.files.get("file")
        if not workspace_id or not title or uploaded is None:
            raise ValidationError("workspace_id, title, and file are required")
        if len(title) > 200:
            raise ValidationError("title exceeds the length limit")
        try:
            version = int(version_raw)
        except ValueError as exc:
            raise ValidationError("version must be an integer") from exc
        if not 1 <= version <= 10_000:
            raise ValidationError("version is outside the accepted range")
        filename = safe_filename(uploaded.filename or "")
        data = uploaded.read(max_upload_bytes() + 1)
        if len(data) > max_upload_bytes():
            raise ValidationError("File exceeds upload size limit")
        sidecar = request.form.get("transcript")
        units = parse_document(filename, data, sidecar_text=sidecar)
        suffix = os.path.splitext(filename)[1].lower()
        modality = (
            "PDF"
            if suffix == ".pdf"
            else "IMAGE"
            if suffix in {".png", ".jpg", ".jpeg"}
            else "AUDIO"
            if suffix in {".wav", ".mp3"}
            else "TEXT"
        )
        document_id = str(uuid.uuid4())
        document = Document(
            id=document_id,
            workspace_id=workspace_id,
            title=title,
            filename=filename,
            version=version,
            modality=modality,
            mime_type=uploaded.mimetype
            or mimetypes.guess_type(filename)[0]
            or "application/octet-stream",
            sha256=hashlib.sha256(data).hexdigest(),
            chunks=chunk_units(document_id, modality, units),
        )
        if not document.chunks:
            raise ValidationError("No extractable text was found")
        repo.save_document(document)
        repo.audit(
            workspace_id,
            "DOCUMENT_INGESTED",
            {
                "document_id": document_id,
                "filename": filename,
                "modality": modality,
                "chunk_count": len(document.chunks),
                "prompt_injection_suspected": any(
                    detect_prompt_injection(chunk.content) for chunk in document.chunks
                ),
            },
        )
        return jsonify(document.to_dict()), 201

    @app.post("/api/search")
    def search():
        started = time.perf_counter()
        payload = _json()
        workspace_id = _required(payload, "workspace_id", 80)
        query = _required(payload, "query", 2000)
        results = search_documents(
            repo,
            workspace_id,
            query,
            int(payload.get("limit", 5)),
        )
        latency_ms = round((time.perf_counter() - started) * 1000)
        repo.record_tool_call(
            "search_documents",
            {"workspace_id": workspace_id, "query_length": len(query)},
            {"result_count": len(results)},
            latency_ms,
        )
        return jsonify(
            {"results": results, "latency_ms": latency_ms}
        )

    @app.get("/api/evidence/<chunk_id>")
    def evidence(chunk_id: str):
        started = time.perf_counter()
        result = get_evidence(repo, chunk_id)
        repo.record_tool_call(
            "get_evidence",
            {"chunk_id": chunk_id},
            {"found": True},
            round((time.perf_counter() - started) * 1000),
        )
        return jsonify(result)

    @app.post("/api/verify")
    def verify():
        started = time.perf_counter()
        payload = _json()
        chunk_id = _required(payload, "chunk_id", 80)
        quote = _required(payload, "quote", 20_000)
        result = verify_citation(repo, chunk_id, quote)
        repo.record_tool_call(
            "verify_citation",
            {"chunk_id": chunk_id, "quote_length": len(quote)},
            {"verified": result["verified"], "match_type": result["match_type"]},
            round((time.perf_counter() - started) * 1000),
        )
        return jsonify(result)

    @app.post("/api/compare")
    def compare():
        started = time.perf_counter()
        payload = _json()
        older_id = _required(payload, "older_document_id", 80)
        newer_id = _required(payload, "newer_document_id", 80)
        result = compare_document_versions(repo, older_id, newer_id)
        repo.record_tool_call(
            "compare_document_versions",
            {"older_document_id": older_id, "newer_document_id": newer_id},
            {"change_count": result["change_count"]},
            round((time.perf_counter() - started) * 1000),
        )
        return jsonify(result)

    @app.post("/api/reviews")
    def review():
        started = time.perf_counter()
        payload = _json()
        workspace_id = _required(payload, "workspace_id", 80)
        reason = _required(payload, "reason", 1000)
        risk = str(payload.get("risk_level", "medium")).lower()
        if risk not in {"low", "medium", "high"}:
            raise ValidationError("risk_level must be low, medium, or high")
        item = repo.create_review(workspace_id, reason, risk, payload.get("payload", {}))
        repo.audit(
            workspace_id,
            "HUMAN_REVIEW_REQUESTED",
            {"review_id": item["id"], "reason": reason, "risk_level": risk},
        )
        repo.record_tool_call(
            "request_human_review",
            {"workspace_id": workspace_id, "risk_level": risk},
            {"review_id": item["id"], "status": item["status"]},
            round((time.perf_counter() - started) * 1000),
        )
        return jsonify(item), 201

    @app.post("/api/conversation-turns")
    def save_conversation_turn():
        payload = _json()
        workspace_id = _required(payload, "workspace_id", 80)
        user_content = _required(payload, "user_content", 20_000)
        assistant_content = _required(payload, "assistant_content", 50_000)
        conversation_id = payload.get("conversation_id")
        if conversation_id is not None and not isinstance(conversation_id, str):
            raise ValidationError("conversation_id must be a string")
        resolved_id = repo.save_turn(
            workspace_id,
            conversation_id,
            str(payload.get("title") or user_content[:80]),
            user_content,
            assistant_content,
        )
        repo.audit(
            workspace_id,
            "CONVERSATION_TURN_RECORDED",
            {"conversation_id": resolved_id},
        )
        return jsonify({"conversation_id": resolved_id}), 201

    @app.get("/api/audit")
    def audit():
        return jsonify({"events": repo.audit_events(request.args.get("workspace_id"))})

    @app.errorhandler(EvidenceBridgeError)
    def handle_known_error(exc: EvidenceBridgeError):
        LOGGER.warning("request_failed code=%s path=%s", exc.code, request.path)
        return jsonify({"error": {"code": exc.code, "message": str(exc)}}), exc.status_code

    @app.errorhandler(RequestEntityTooLarge)
    def handle_large_file(_exc: RequestEntityTooLarge):
        return jsonify(
            {"error": {"code": "file_too_large", "message": "Upload exceeds the configured limit"}}
        ), 413

    @app.errorhandler(Exception)
    def handle_unexpected_error(exc: Exception):
        LOGGER.exception("unexpected_error path=%s", request.path)
        return jsonify(
            {"error": {"code": "internal_error", "message": "The request could not be completed"}}
        ), 500

    return app
