# Optional PEFT router experiment

This stage is deliberately excluded from the default setup and CI. No completed fine-tuning result is claimed.

`smoke_test.py` validates the deterministic split and metric implementation without downloading a model. `train_router.py` is the complete optional experiment: it compares zero-shot base inference, three-example prompt-only inference, and a LoRA adapter on the same held-out split and saves the requested metrics plus timing and peak CUDA allocation.

Run only on suitable local hardware:

```bash
python -m venv .venv-peft
.venv-peft/bin/pip install -r peft/requirements-peft.txt
.venv-peft/bin/python peft/train_router.py
```

The default dataset is intentionally tiny. Any result is a smoke experiment, not evidence of production model training or generalisation.
