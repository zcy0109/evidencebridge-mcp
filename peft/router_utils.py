from __future__ import annotations

import hashlib
from collections import Counter
from typing import Dict, Iterable, List

LABELS = ("ANSWER", "REFUSE", "REVIEW")


def deterministic_split(records: List[Dict[str, str]], test_ratio: float = 0.25):
    ordered = sorted(records, key=lambda row: hashlib.sha256(row["id"].encode()).hexdigest())
    test_size = max(3, round(len(ordered) * test_ratio))
    return ordered[test_size:], ordered[:test_size]


def classification_metrics(gold: Iterable[str], predicted: Iterable[str]) -> Dict[str, float]:
    gold_values = list(gold)
    predicted_values = list(predicted)
    if len(gold_values) != len(predicted_values) or not gold_values:
        raise ValueError("gold and predicted must have the same non-zero length")
    accuracy = sum(a == b for a, b in zip(gold_values, predicted_values)) / len(gold_values)
    f1_values = []
    for label in LABELS:
        true_positive = sum(a == label and b == label for a, b in zip(gold_values, predicted_values))
        false_positive = sum(a != label and b == label for a, b in zip(gold_values, predicted_values))
        false_negative = sum(a == label and b != label for a, b in zip(gold_values, predicted_values))
        precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else 0
        recall = true_positive / (true_positive + false_negative) if true_positive + false_negative else 0
        f1_values.append(2 * precision * recall / (precision + recall) if precision + recall else 0)
    review_gold = sum(value == "REVIEW" for value in gold_values)
    review_hits = sum(a == "REVIEW" and b == "REVIEW" for a, b in zip(gold_values, predicted_values))
    high_risk_wrong_answers = sum(a == "REVIEW" and b == "ANSWER" for a, b in zip(gold_values, predicted_values))
    return {
        "accuracy": round(accuracy, 4),
        "macro_f1": round(sum(f1_values) / len(f1_values), 4),
        "high_risk_wrong_answer_rate": round(high_risk_wrong_answers / review_gold, 4) if review_gold else 0,
        "human_review_recall": round(review_hits / review_gold, 4) if review_gold else 0,
    }


def distribution(records: Iterable[Dict[str, str]]) -> Dict[str, int]:
    return dict(Counter(record["label"] for record in records))
