# Support Ticket: GPT‑OSS streaming/"thinking" differs from other Berget models

**Status: ✅ RESOLVED** (November 2025)

Berget AI has updated their API and GPT-OSS streaming now works correctly with standard OpenAI-compatible delta semantics.

**Verification:**
- Test script: `scripts/test-gpt-oss-streaming.mjs`
- Results: 273 deltas received, proper text streaming ✓, reasoning streaming ✓
- All workarounds have been removed from the codebase

---

## Original Issue (RESOLVED)

### Summary
OpenAI GPT‑OSS 120B model on Berget behaves differently from Qwen3 32B and DeepSeek R1 Microsoft AI Finetuned when using the OpenAI‑compatible `POST /v1/chat/completions` with `stream: true`. Other models stream deltas and render live in our UI out‑of‑the‑box; GPT‑OSS frequently either sends no deltas (only a terminal finish) or a Responses‑style reasoning/text format that is not emitted incrementally. This causes UI stalls and prevents consistent “thinking” streaming.

## Environment
- Endpoint: `https://api.berget.ai/v1/chat/completions`
- Model: `openai/gpt-oss-120b`
- Client: Vercel AI SDK v5 (LanguageModelV2), OpenAI‑compatible provider

## Expected (based on other Berget models)
- SSE frames with `choices[0].delta.content` for text
- Optional reasoning streaming via either:
  - `choices[0].delta.reasoning_content`, or
  - tags embedded in `delta.content` (e.g., `<think>…</think>`) emitted incrementally
- Proper termination (`[DONE]` / final `finish` after deltas)

## Actual with GPT‑OSS
- Often sends:
  - `stream-start`
  - immediate `finish` (no `text-delta`, no reasoning deltas)
- In other cases, sends Responses‑style fields (e.g., `reasoning_content`/`output_text`) but not incrementally via `choices[].delta`, so nothing streams in a standard OpenAI client.
- Because no deltas arrive, clients can remain in a non‑ready state, blocking follow‑up prompts.

## Minimal repro
```http
POST https://api.berget.ai/v1/chat/completions
Authorization: Bearer <BERGET_AI_API_KEY>
Content-Type: application/json

{
  "model": "openai/gpt-oss-120b",
  "messages": [
    {"role": "user", "content": "Write one sentence and think step-by-step."}
  ],
  "stream": true
}
```
Observed (sample logs):
```
stream-start
finish (no deltas)
```

## Works with these models (same client and endpoint)
- `unsloth/MAI-DS-R1-GGUF`
- `Qwen/Qwen3-32B`
- `meta-llama/Llama-3.3-70B-Instruct`
- `mistralai/Magistral-Small-2506`

## Request (COMPLETED ✅)
- Align GPT‑OSS `chat/completions` streaming with standard OpenAI delta semantics used by other Berget models:
  - ✅ Emit `choices[].delta.content` for text increments
  - ✅ Emit `choices[].delta.reasoning_content` for "thinking"
  - ✅ Ensure final termination is sent after deltas

## Resolution

Berget AI successfully implemented proper OpenAI-compatible streaming for the GPT-OSS model. The API now:
- Emits incremental `choices[].delta.content` chunks (verified 273+ deltas in test)
- Properly streams reasoning via `choices[].delta.reasoning_content`
- Sends proper termination after all deltas

No client-side workarounds are needed. The standard OpenAI-compatible provider works perfectly.
