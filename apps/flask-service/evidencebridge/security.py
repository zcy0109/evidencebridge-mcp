from __future__ import annotations

import hmac
import os
import re
from pathlib import Path
from typing import Optional

from flask import Request
from werkzeug.utils import secure_filename

from .errors import ValidationError

ALLOWED_EXTENSIONS = {".txt", ".md", ".pdf", ".png", ".jpg", ".jpeg", ".wav", ".mp3"}
INJECTION_PATTERNS = (
    re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.I),
    re.compile(r"system\s+prompt", re.I),
    re.compile(r"<script\b", re.I),
)


def safe_filename(name: str) -> str:
    clean = secure_filename(Path(name).name)
    if not clean or Path(clean).suffix.lower() not in ALLOWED_EXTENSIONS:
        raise ValidationError("Unsupported or unsafe filename")
    return clean


def require_api_token(request: Request, expected: Optional[str]) -> None:
    if not expected:
        return
    supplied = request.headers.get("Authorization", "").removeprefix("Bearer ")
    if not hmac.compare_digest(supplied, expected):
        raise ValidationError("Missing or invalid service token")


def detect_prompt_injection(text: str) -> bool:
    sample = text[:100_000]
    return any(pattern.search(sample) for pattern in INJECTION_PATTERNS)


def max_upload_bytes() -> int:
    return int(os.getenv("MAX_UPLOAD_BYTES", "10485760"))
