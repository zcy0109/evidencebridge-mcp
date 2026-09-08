"""Optional LoRA experiment. Not executed by the default project setup or CI."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from router_utils import LABELS, classification_metrics, deterministic_split

SYSTEM = "Route evidence questions to exactly one label: ANSWER, REFUSE, or REVIEW."
FEW_SHOT = "Question: Quote a supported deadline.\nRoute: ANSWER\nQuestion: Invent a missing fact.\nRoute: REFUSE\nQuestion: Give legal advice.\nRoute: REVIEW\n"


def load_records(path: Path):
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def prompt(text: str, few_shot: bool) -> str:
    examples = FEW_SHOT if few_shot else ""
    return f"{SYSTEM}\n{examples}Question: {text}\nRoute:"


def parse_label(text: str) -> str:
    upper = text.upper()
    return next((label for label in LABELS if label in upper), "REVIEW")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="Qwen/Qwen2.5-0.5B-Instruct")
    parser.add_argument("--epochs", type=int, default=2)
    parser.add_argument("--seed", type=int, default=537095)
    parser.add_argument("--output", type=Path, default=Path("peft/outputs/router-lora"))
    args = parser.parse_args()

    import torch
    from torch.utils.data import Dataset
    from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments

    from peft import LoraConfig, TaskType, get_peft_model

    records = load_records(Path("peft/router_dataset.jsonl"))
    train_rows, test_rows = deterministic_split(records)
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    tokenizer.pad_token = tokenizer.pad_token or tokenizer.eos_token

    class RouterDataset(Dataset):
        def __init__(self, rows):
            self.items = []
            for row in rows:
                prefix = prompt(row["text"], few_shot=False)
                full = f"{prefix} {row['label']}{tokenizer.eos_token}"
                encoded = tokenizer(full, truncation=True, max_length=256, padding="max_length")
                prefix_ids = tokenizer(prefix, truncation=True, max_length=256)["input_ids"]
                labels = encoded["input_ids"].copy()
                labels[: len(prefix_ids)] = [-100] * len(prefix_ids)
                labels = [token if mask else -100 for token, mask in zip(labels, encoded["attention_mask"])]
                encoded["labels"] = labels
                self.items.append({key: torch.tensor(value) for key, value in encoded.items()})

        def __len__(self):
            return len(self.items)

        def __getitem__(self, index):
            return self.items[index]

    def load_model():
        return AutoModelForCausalLM.from_pretrained(
            args.model,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        )

    def evaluate(model, few_shot: bool):
        predictions, latencies = [], []
        model.eval()
        for row in test_rows:
            inputs = tokenizer(prompt(row["text"], few_shot), return_tensors="pt").to(model.device)
            started = time.perf_counter()
            with torch.no_grad():
                output = model.generate(**inputs, max_new_tokens=4, do_sample=False)
            latencies.append((time.perf_counter() - started) * 1000)
            generated = tokenizer.decode(output[0][inputs["input_ids"].shape[1] :])
            predictions.append(parse_label(generated))
        result = classification_metrics([row["label"] for row in test_rows], predictions)
        result["average_inference_ms"] = round(sum(latencies) / len(latencies), 2)
        result["peak_vram_mb"] = round(torch.cuda.max_memory_allocated() / 1024**2, 2) if torch.cuda.is_available() else 0
        return result

    base = load_model()
    base_metrics = evaluate(base, few_shot=False)
    prompt_metrics = evaluate(base, few_shot=True)
    lora = get_peft_model(
        base,
        LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            r=8,
            lora_alpha=16,
            lora_dropout=0.05,
            target_modules=["q_proj", "v_proj"],
        ),
    )
    training_args = TrainingArguments(
        output_dir=str(args.output),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        logging_steps=1,
        save_strategy="no",
        seed=args.seed,
        report_to=[],
    )
    Trainer(model=lora, args=training_args, train_dataset=RouterDataset(train_rows)).train()
    lora_metrics = evaluate(lora, few_shot=False)
    args.output.mkdir(parents=True, exist_ok=True)
    lora.save_pretrained(args.output)
    result = {
        "model": args.model,
        "seed": args.seed,
        "train_size": len(train_rows),
        "test_size": len(test_rows),
        "base": base_metrics,
        "prompt_only": prompt_metrics,
        "lora_peft": lora_metrics,
        "disclosure": "Local run output. Review split size and uncertainty before making claims.",
    }
    (args.output / "metrics.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
