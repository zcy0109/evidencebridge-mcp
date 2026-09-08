from __future__ import annotations

import hashlib
import json
import platform
import re
import sys
import time
import uuid
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "flask-service"))

from evidencebridge.chunking import chunk_units, terms  # noqa: E402
from evidencebridge.models import Document  # noqa: E402
from evidencebridge.parsers import ParsedUnit  # noqa: E402
from evidencebridge.repository import MemoryRepository  # noqa: E402
from evidencebridge.retrieval import search_documents, verify_citation  # noqa: E402

VERSION = "deterministic-components-v2"
STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "at",
    "be",
    "do",
    "for",
    "from",
    "how",
    "in",
    "is",
    "me",
    "of",
    "on",
    "the",
    "to",
    "what",
    "when",
    "which",
    "who",
}


@dataclass
class Outcome:
    question_id: str
    variant: str
    answer: str
    retrieved_document: Optional[str]
    citation: Optional[str]
    citation_verified: bool
    review_requested: bool
    tools_attempted: int
    tools_succeeded: int
    latency_ms: float
    failures: List[str]


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line
    ]


def build_repository() -> tuple[MemoryRepository, str]:
    repository = MemoryRepository()
    workspace = repository.create_workspace("evaluation")
    for path in sorted((ROOT / "examples" / "materials").glob("*.md")):
        document_id = str(uuid.uuid4())
        title = path.stem
        version_match = re.search(r"-v(\d+)$", title)
        document = Document(
            id=document_id,
            workspace_id=workspace["id"],
            title=title,
            filename=path.name,
            version=int(version_match.group(1)) if version_match else 1,
            modality="TEXT",
            mime_type="text/markdown",
            sha256="evaluation-fixture",
            chunks=chunk_units(
                document_id,
                "TEXT",
                [ParsedUnit(path.read_text(encoding="utf-8"))],
                max_chars=420,
                overlap_lines=0,
            ),
        )
        repository.save_document(document)
    return repository, workspace["id"]


def best_sentence(text: str, query: str) -> str:
    sentences = [
        item.strip() for item in re.split(r"(?<=[.!?])\s+|\n", text) if item.strip()
    ]
    query_terms = terms(query) - STOPWORDS or terms(query)

    def score(item: str) -> tuple[int, float]:
        item_terms = terms(item) - STOPWORDS or terms(item)
        overlap = query_terms & item_terms
        return len(overlap), len(overlap) / max(1, len(item_terms))

    return max(sentences, key=score, default="")


def assess(
    outcome: Outcome, question: Dict[str, Any], source_texts: Dict[str, str]
) -> None:
    normal_answer = outcome.answer.casefold()
    if question["answerable"]:
        if question["expected"].casefold() not in normal_answer:
            outcome.failures.append("answer_mismatch")
        if (
            outcome.retrieved_document
            and outcome.retrieved_document != question["document"]
        ):
            outcome.failures.append("retrieval_miss")
    elif outcome.answer and "cannot answer" not in normal_answer:
        outcome.failures.append("unsupported_claim")
    if outcome.citation:
        source = source_texts.get(outcome.retrieved_document or "", "")
        if outcome.citation.casefold() not in source.casefold():
            outcome.failures.append("citation_mismatch")
    if question["needs_review"] and not outcome.review_requested:
        outcome.failures.append("missed_review")
    if not question["needs_review"] and outcome.review_requested:
        outcome.failures.append("false_review")


def run_variant(
    variant: str,
    question: Dict[str, Any],
    repository: MemoryRepository,
    workspace_id: str,
    source_texts: Dict[str, str],
) -> Outcome:
    started = time.perf_counter()
    tools_attempted = tools_succeeded = 0
    citation = retrieved_document = None
    verified = review = False
    if variant == "direct_answer":
        corpus = "\n".join(source_texts.values())
        answer = best_sentence(corpus, question["query"])
    else:
        tools_attempted += 1
        results = search_documents(repository, workspace_id, question["query"], limit=3)
        tools_succeeded += 1
        if results:
            top = results[0]
            retrieved_document = top["filename"]
            citation = best_sentence(top["quote"], question["query"])
            answer = citation
        else:
            answer = "I cannot answer from the available materials."
        if variant == "rag_mcp_verified":
            if results and citation:
                tools_attempted += 1
                verification = verify_citation(
                    repository, results[0]["chunk_id"], citation
                )
                tools_succeeded += 1
                verified = bool(verification["verified"])
            informative_query = terms(question["query"]) - STOPWORDS
            evidence_terms = terms(citation or "") - STOPWORDS
            support_coverage = (
                len(informative_query & evidence_terms) / len(informative_query)
                if informative_query
                else 0.0
            )
            low_support = support_coverage < 0.2
            high_risk = bool(
                re.search(r"legal advice|liab|diagnos|medical", question["query"], re.I)
            )
            review = not results or not verified or low_support or high_risk
            if low_support:
                answer = "I cannot answer from the available materials."
            if review:
                tools_attempted += 1
                repository.create_review(
                    workspace_id,
                    "Evidence absent, unverified, or decision is high risk",
                    "high" if high_risk else "medium",
                    {"question_id": question["id"]},
                )
                tools_succeeded += 1
    outcome = Outcome(
        question_id=question["id"],
        variant=variant,
        answer=answer,
        retrieved_document=retrieved_document,
        citation=citation,
        citation_verified=verified,
        review_requested=review,
        tools_attempted=tools_attempted,
        tools_succeeded=tools_succeeded,
        latency_ms=round((time.perf_counter() - started) * 1000, 4),
        failures=[],
    )
    assess(outcome, question, source_texts)
    return outcome


def metrics(outcomes: List[Outcome], questions: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_id = {question["id"]: question for question in questions}
    answerable = sum(1 for q in questions if q["answerable"])
    review_needed = sum(1 for q in questions if q["needs_review"])
    valid_citations = sum(
        1
        for item in outcomes
        if by_id[item.question_id]["answerable"]
        and item.citation_verified
        and item.retrieved_document == by_id[item.question_id]["document"]
        and by_id[item.question_id]["expected"].casefold()
        in (item.citation or "").casefold()
    )
    retrieval_hits = sum(
        1
        for item in outcomes
        if by_id[item.question_id]["answerable"]
        and item.retrieved_document == by_id[item.question_id]["document"]
    )
    unsupported = sum(
        1
        for item in outcomes
        if "unsupported_claim" in item.failures or "answer_mismatch" in item.failures
    )
    review_hits = sum(
        1
        for item in outcomes
        if by_id[item.question_id]["needs_review"] and item.review_requested
    )
    tool_attempts = sum(item.tools_attempted for item in outcomes)
    return {
        "questions": len(outcomes),
        "citation_accuracy": round(valid_citations / answerable, 4),
        "evidence_retrieval_recall": round(retrieval_hits / answerable, 4),
        "unsupported_claim_rate": round(unsupported / len(outcomes), 4),
        "tool_call_success_rate": round(
            sum(item.tools_succeeded for item in outcomes) / tool_attempts, 4
        )
        if tool_attempts
        else None,
        "human_review_recall": round(review_hits / review_needed, 4),
        "average_latency_ms": round(
            sum(item.latency_ms for item in outcomes) / len(outcomes), 4
        ),
        "failure_distribution": dict(
            sorted(
                Counter(
                    failure for item in outcomes for failure in item.failures
                ).items()
            )
        ),
    }


def main() -> None:
    started_at = datetime.now(timezone.utc)
    dataset_path = ROOT / "evaluation" / "questions.jsonl"
    questions = load_jsonl(dataset_path)
    repository, workspace_id = build_repository()
    source_texts = {
        path.name: path.read_text(encoding="utf-8")
        for path in (ROOT / "examples" / "materials").glob("*.md")
    }
    variants = ("direct_answer", "basic_rag", "rag_mcp_verified")
    all_outcomes = [
        run_variant(variant, question, repository, workspace_id, source_texts)
        for variant in variants
        for question in questions
    ]
    run_id = started_at.strftime("%Y%m%dT%H%M%SZ")
    run_dir = ROOT / "evaluation" / "runs"
    run_dir.mkdir(parents=True, exist_ok=True)
    raw_path = run_dir / f"{run_id}-raw.jsonl"
    raw_path.write_text(
        "\n".join(json.dumps(asdict(item), ensure_ascii=False) for item in all_outcomes)
        + "\n",
        encoding="utf-8",
    )
    summary = {
        "run_id": run_id,
        "version": VERSION,
        "mode": "deterministic_components_no_llm",
        "started_at": started_at.isoformat(),
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "configuration": {
            "python": platform.python_version(),
            "dataset": str(dataset_path.relative_to(ROOT)),
            "dataset_sha256": hashlib.sha256(dataset_path.read_bytes()).hexdigest(),
            "question_count": len(questions),
            "seed": None,
        },
        "metrics": {
            variant: metrics(
                [item for item in all_outcomes if item.variant == variant], questions
            )
            for variant in variants
        },
        "raw_records": str(raw_path.relative_to(ROOT)),
        "disclosure": "Deterministic component evaluation; these are not real LLM results.",
    }
    summary_path = run_dir / f"{run_id}-summary.json"
    summary_path.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
