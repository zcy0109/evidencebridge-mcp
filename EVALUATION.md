# Evaluation

## Technical summary

- The original v1 deterministic run exposed seven wrong-version retrieval misses, short-title chunk bias, and answer-selection errors: the verified workflow recorded 0.825 retrieval recall, 0.600 strict citation accuracy, and a 0.3333 unsupported/mismatch rate.
- Retrieval v2 adds explicit version filtering, latest-version tie-breaking, content-coverage ranking without aggressive short-chunk normalisation, stopword-aware sentence selection, and a small disclosed lexical normalization map. On the same fixed 45-question regression set it records 1.000 retrieval recall, 1.000 strict citation accuracy, 0.000 unsupported/mismatch rate, 1.000 tool-call success, and 1.000 review recall.
- This is an **in-sample regression result after inspecting the same questions**. It proves that the documented fixture failures were closed; it does not establish held-out generalisation, real-LLM quality, multilingual retrieval quality, or production performance.
- The next scientifically useful evaluation is a frozen holdout corpus created by someone who has not tuned the current rules, followed by a hybrid lexical/embedding comparison.

## Scope, dataset, and controlling records

- Source corpus: six synthetic documents under `examples/materials/`, created for this repository.
- Question population: 45 records in `evaluation/questions.jsonl`; 40 answerable and 5 deliberately unanswerable.
- Review-positive population: 11 questions: 5 unanswerable and 6 high-risk/boundary cases.
- Grain: one outcome per question per variant, producing 135 raw records per run.
- Fixed dataset SHA-256: `3d489333c981c762a570579c14c989fdfa459dbe19430692cd0ea8e956433b8b`.
- Baseline: `20260907T072434Z`, deterministic components v1, Python 3.12.14.
- Current regression: `20260908T090054Z`, deterministic components v2, Python 3.12.14.

Each question fixes the expected answer phrase, expected source, exact evidence phrase, answerability, and expected review route. The saved raw JSONL files are the controlling evidence; summary values are derived from them.

## Compared variants

1. **Direct answer** scans the corpus without retrieval citations, verification, or review.
2. **Basic RAG** retrieves the top lexical/metadata-ranked chunk and copies its best-overlap sentence without citation verification.
3. **RAG + MCP verification logic** uses the production retrieval and citation-verification functions exposed through MCP, checks informative-term support, and requests review for absent, weakly supported, unverified, or high-risk cases. A separate official-SDK stdio integration test verifies that all five MCP tools are discoverable and callable.

## Metric definitions

| Metric | Definition |
|---|---|
| Citation accuracy | Answerable questions whose citation is verified, comes from the gold document, and contains the expected answer, divided by 40 answerable questions |
| Evidence retrieval recall | Answerable questions whose top retrieved document equals the gold document, divided by 40 |
| Unsupported claim rate | Questions with an answer mismatch or an answer on an unanswerable item, divided by 45 |
| Tool-call success rate | Successful deterministic tool operations divided by attempted operations; not applicable to direct answer |
| Human-review recall | Expected-review questions routed to review, divided by 11 |
| Average latency | Mean in-process wall-clock milliseconds for one local run; excludes HTTP, model, queue, and browser latency |
| Failure distribution | Counts of answer mismatch, retrieval miss, unsupported claim, missed review, and false review flags |

## Current v2 saved results

| Variant | Citation accuracy | Retrieval recall | Unsupported claim rate | Tool success | Review recall | Avg latency (ms) |
|---|---:|---:|---:|---:|---:|---:|
| Direct answer | 0.000 | 0.000 | 0.2222 | N/A | 0.000 | 0.2842 |
| Basic RAG | 0.000 | 1.000 | 0.0000 | 1.000 | 0.000 | 1.0880 |
| RAG + verification | 1.000 | 1.000 | 0.0000 | 1.000 | 1.000 | 1.1380 |

Raw record: `evaluation/runs/20260908T090054Z-raw.jsonl`  
Configuration and summary: `evaluation/runs/20260908T090054Z-summary.json`

## What changed from v1 to v2

| Verified workflow metric | v1 baseline | v2 same-set regression | Change |
|---|---:|---:|---:|
| Strict citation accuracy | 0.600 | 1.000 | +0.400 |
| Evidence retrieval recall | 0.825 | 1.000 | +0.175 |
| Unsupported/mismatch rate | 0.3333 | 0.0000 | -0.3333 |
| Tool-call success | 1.000 | 1.000 | 0.000 |
| Human-review recall | 1.000 | 1.000 | 0.000 |

The seven v1 source-level misses all selected version 1 when the gold source was version 2. The dominant driver was not missing vocabulary: length-normalised lexical scores systematically favoured the slightly shorter v1 body, while single-digit version tokens were previously discarded. V2 treats explicit versions as metadata filters and prefers the latest document version on otherwise equal evidence.

The remaining v1 answer mismatches concentrated in short headings outranking longer evidence chunks or transparent lexical differences such as `attendance`/`attend`, `required`/`require`, and `response`/`answered`. V2 ranks by informative-query coverage plus IDF, removes stopwords for sentence selection, and uses an eight-entry normalization map. No gold answer text is read by production retrieval.

## Calculation checks

- Raw row count: 45 questions × 3 variants = 135.
- V2 verified retrieval recall: 40/40 = 1.000.
- V2 strict valid citations: 40/40 = 1.000.
- V2 unsupported/mismatched answers: 0/45 = 0.0000.
- V2 expected reviews routed: 11/11 = 1.000.
- V2 verified failure flags: 0 across the fixed regression set.

## Representative behavior

**Version failure closed:** “On what date do research applications close in version 2?” previously selected the shorter v1 document. V2 filters to document version 2 before content scoring and returns “15 May.”

**Short-title bias closed:** legal-clinic questions previously allowed the compact title chunk to outrank the evidence-bearing body. Content-coverage scoring now ranks the sentence-bearing chunk above a heading that merely repeats the document topic.

**Safety boundary retained:** a question about a laboratory uniform has no supporting evidence. The verified workflow still refuses and requests human review; the retrieval changes did not reduce review recall.

## Methodology and reproducibility

The runner builds an in-memory repository from the six checked-in documents, executes every variant over the same ordered questions, and writes UTC timestamps, component version, Python version, dataset path and SHA-256, summary metrics, and one raw JSON line per question/variant.

```bash
.venv/bin/python evaluation/run_evaluation.py
PYTHONPATH=. .venv/bin/pytest -q evaluation/tests
```

Latency is descriptive for this local in-process run only. It should not be compared with hosted LLM latency. The stdio MCP transport is tested separately so retrieval metric changes are not confused with transport availability.

## Limitations and robustness

- The same fixed questions were used for diagnosis and post-change verification. The v2 1.000 values are regression closure, not an unbiased estimate.
- The corpus is small, synthetic, English-only, and hand-authored. It does not represent OCR noise, long documents, legal ambiguity, multilingual material, or adversarial paraphrases.
- The normalization map was selected after observing failure categories. It is intentionally inspectable but may not transfer to unseen vocabulary.
- Citation verification proves source-string agreement, not entailment, completeness, currency, authority, or correct legal interpretation.
- No confidence interval is meaningful as a generalisation claim for this tuned, non-random 45-item set.
- No Azure/OpenAI request, model cost, token usage, or live-model latency was measured.

## Recommended next evaluation

1. Freeze v2 and commission an untouched holdout set with new documents, paraphrases, multilingual questions, version ambiguity, and adversarial distractors.
2. Compare lexical v2 with a hybrid embedding/reranking implementation on both the retained regression set and the frozen holdout.
3. Report regression and holdout results separately; never replace the v1 record or describe the in-sample 1.000 values as model quality.

## Further questions

- How much of the improvement survives new document families and unseen synonyms?
- Does latest-version preference remain safe when older versions are explicitly authoritative for a historical question?
- Which citation-entailment verifier can reduce exact-string false confidence without adding unacceptable latency or external-data exposure?
