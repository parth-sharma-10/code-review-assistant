# Decision: schema-validate model output, retry once with the errors, ground findings in real files

## Problem

Reviews must be structured (a summary; issues with severity, file, line and recommendation; plus
recommendations) so the UI can count, sort and link them. Language models, especially small local
ones, return invalid JSON, wrap it in prose or code fences, use the wrong case for enums, send line
numbers as strings, and invent files and line numbers. Uploaded code can also try to steer the model.

## Alternatives

| Option | Notes |
|---|---|
| Show raw model text | No counts, no links, no guarantees; rejected by the brief |
| Provider-native structured output (`json_schema`) | Strong where supported; not portable across the supported providers (see `ai-provider-architecture.md`) |
| Function / tool calling | Same portability problem; small local models are unreliable with tools |
| **Prompted JSON + parse + Zod validation + one corrective retry** | Works on every provider; failures become explicit and controlled |

## Evidence

- OWASP Top 10 for LLM Applications, LLM01 Prompt Injection, lists as mitigations: "Separate and
  clearly denote untrusted content to limit its influence on user prompts", and "use deterministic code
  to validate adherence to these formats". https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- Observed in this project with `qwen2.5-coder:7b`:
  - All six review, diff and architecture runs ended in schema-valid output. Whether any of them
    needed the retry was not recorded at the time. Retries are now logged (`[AI] Structured output
    attempt 1/2 invalid: …`, validation errors only), so the retry rate can be measured.
  - The v1 performance prompt produced a CRITICAL *security* finding. That led to the stricter
    focus rule in `review-v2`.
  - Chat answers copied the `12| ` line-number margin into code blocks even after an explicit
    instruction, so it is now stripped deterministically after the call.

## Decision

1. **The prompt** states the rules: analyse only supplied files; never invent files, findings or line
   numbers; definite problems go in `issues`, suggestions in `recommendations`; stay within the review
   mode's focus; an empty issue list is valid. It also gives the exact JSON shape.
2. **Extraction** takes the contents of a ```` ```json ```` fence if present, then the text from the
   first `{` to the last `}`.
3. **Validation** uses Zod (`backend/src/ai/schemas.ts`), with length caps on every string and caps on
   array sizes. Harmless normalisation is accepted, such as `"high"` → `HIGH` and `"12"` → `12`.
   Structural problems fail.
4. **Retry once.** On failure, the original prompt, the model's reply and the first eight validation
   errors (`issues.0.severity: Invalid option`) are sent back with "respond with ONLY the corrected
   JSON". After two failures the API returns **502** with an actionable message, and nothing is stored.
5. **Grounding**, applied after validation:
   - Issues citing a file that was not in the context are dropped and counted (`discardedIssues`, shown
     in the UI).
   - Line numbers beyond the end of the file become `null`.
   - For architecture analysis, component paths that are neither a file nor a directory in the tree
     become `null`.
6. **Line-numbered context** (`12| code`) means that when the model cites a line, it copies a number it
   was shown instead of counting.
7. **Prompts are versioned.** The version is saved with each review (`result.meta.promptVersion`).

## Tradeoffs

- A retry doubles latency and cost on failure. One retry is the balance: in testing, a second failure
  usually meant the model could not do the task, not that it made a typo.
- Grounding catches invented *files* and impossible *lines*. It cannot catch a wrong claim about a
  real line; that still needs human judgement, which the UI supports by linking every finding to the
  code.
- Normalising case and numeric strings is deliberately lenient. Being strict would fail reviews over
  trivia on small models without improving correctness.
