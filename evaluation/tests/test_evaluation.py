import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from evaluation.run_evaluation import (  # noqa: E402
    build_repository,
    load_jsonl,
    metrics,
    run_variant,
)


def test_dataset_has_at_least_40_gold_questions():
    questions = load_jsonl(ROOT / "evaluation" / "questions.jsonl")
    assert len(questions) >= 40
    assert all(
        {"expected", "evidence_phrase", "answerable", "needs_review"} <= question.keys()
        for question in questions
    )


def test_verified_variant_closes_the_fixed_regression_set():
    questions = load_jsonl(ROOT / "evaluation" / "questions.jsonl")
    repository, workspace_id = build_repository()
    source_texts = {
        path.name: path.read_text()
        for path in (ROOT / "examples" / "materials").glob("*.md")
    }
    outcomes = [
        run_variant(
            "rag_mcp_verified", question, repository, workspace_id, source_texts
        )
        for question in questions
    ]
    result = metrics(outcomes, questions)
    assert result["citation_accuracy"] == 1.0
    assert result["evidence_retrieval_recall"] == 1.0
    assert result["unsupported_claim_rate"] == 0.0
    assert result["human_review_recall"] == 1.0
    assert result["tool_call_success_rate"] == 1.0
