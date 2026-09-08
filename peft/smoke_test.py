from __future__ import annotations

import json
from pathlib import Path

from router_utils import classification_metrics, deterministic_split, distribution


def main() -> None:
    records = [json.loads(line) for line in Path("peft/router_dataset.jsonl").read_text().splitlines()]
    train, test = deterministic_split(records)
    assert len(train) + len(test) == len(records)
    assert set(distribution(records)) == {"ANSWER", "REFUSE", "REVIEW"}
    perfect = classification_metrics([row["label"] for row in test], [row["label"] for row in test])
    assert perfect["accuracy"] == 1.0
    print(json.dumps({"status": "smoke_passed", "records": len(records), "train": len(train), "test": len(test)}))


if __name__ == "__main__":
    main()
