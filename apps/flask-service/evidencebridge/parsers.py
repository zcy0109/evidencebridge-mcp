from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from pypdf import PdfReader

from .errors import UnsupportedMediaError, ValidationError


@dataclass(frozen=True)
class ParsedUnit:
    text: str
    page_number: Optional[int] = None
    start_ms: Optional[int] = None
    end_ms: Optional[int] = None


def _decode_text(data: bytes) -> str:
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValidationError("Text files must be UTF-8 encoded") from exc


def parse_document(
    filename: str, data: bytes, sidecar_text: Optional[str] = None
) -> List[ParsedUnit]:
    suffix = Path(filename).suffix.lower()
    if suffix in {".txt", ".md"}:
        return [ParsedUnit(_decode_text(data))]
    if suffix == ".pdf":
        try:
            reader = PdfReader(io.BytesIO(data))
            if len(reader.pages) > 200:
                raise ValidationError("PDF exceeds the 200-page parsing limit")
            return [
                ParsedUnit(page.extract_text() or "", index + 1)
                for index, page in enumerate(reader.pages)
            ]
        except ValidationError:
            raise
        except Exception as exc:
            raise ValidationError("PDF parsing failed") from exc
    if suffix in {".png", ".jpg", ".jpeg"}:
        if sidecar_text is None:
            raise UnsupportedMediaError(
                "Image adapter is available, but OCR requires optional pytesseract or a supplied transcript"
            )
        return [ParsedUnit(sidecar_text, page_number=1)]
    if suffix in {".wav", ".mp3"}:
        if sidecar_text is None:
            raise UnsupportedMediaError(
                "Audio adapter is available, but transcription requires an optional provider or a supplied transcript"
            )
        return [ParsedUnit(sidecar_text, start_ms=0, end_ms=None)]
    raise UnsupportedMediaError("Unsupported document type")
