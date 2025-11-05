### Berget AI Integration

This app integrates [Berget AI](https://api.berget.ai/) using the standard OpenAI‑compatible provider from the Vercel AI SDK.

Configuration

```env
BERGET_AI_API_KEY=your_api_key
```

Key files

- `lib/ai/providers.ts` — wires all Berget models via the OpenAI‑compatible provider with reasoning middleware where needed.

Models and capabilities (verified)

- Tool‑calling supported on Berget:
  - `meta-llama/Llama-3.1-8B-Instruct`
  - `meta-llama/Llama-3.3-70B-Instruct`
  - `mistralai/Devstral-Small-2505`
  - `mistralai/Magistral-Small-2506`
- Tool‑calling not available on these endpoints (Berget returns 400 if tools are sent):
  - `openai/gpt-oss-120b`
  - `unsloth/MAI-DS-R1-GGUF` (DeepSeek R1)
  - `mistralai/Mistral-Small-3.1-24B-Instruct-2503`
  - `KBLab/kb-whisper-large`, `BAAI/bge-reranker-v2-m3`, `intfloat/multilingual-e5-large-instruct`, `Qwen/Qwen3-32B`

How tools are sent

- For supported models the provider sends both `tools + tool_choice=auto` and legacy `functions + function_call=auto`.
- JSON Schemas are mapped for project tools:
  - `searchWeb`, `getWeather`, `scrapeUrl`, `createDocument`, `updateDocument`, `requestSuggestions`, `generateImageTool`.
- For unsupported models the provider omits tools entirely to avoid 400s.

Reasoning UI

- Some endpoints (e.g., GPT‑OSS, DeepSeek R1) embed reasoning inside the text using `<think>…</think>` tags. The `extractReasoningMiddleware` extracts these and emits AI SDK reasoning parts so the UI shows a proper "thinking" block.

Streaming

- All Berget models now stream properly using standard OpenAI‑compatible SSE format with `choices[].delta.content` and `choices[].delta.reasoning_content`.
- ✅ **GPT-OSS streaming issue resolved** (as of Nov 2025): Previously GPT‑OSS would send only a `finish` without deltas, but Berget AI has fixed their API and streaming now works correctly. See resolved ticket: `docs/support-tickets/berget-oss-streaming-ticket.md`.

Model routing and current behavior

- **All models** use the OpenAI‑compatible provider and stream text/reasoning normally
- Models with reasoning capabilities (GPT‑OSS, DeepSeek R1, Qwen3 32B): wrapped with `extractReasoningMiddleware({ tagName: 'think' })` to extract `<think>` tags
- Models without reasoning (Llama 3.3 70B, Magistral Small 2506): use the provider directly

Debugging & scripts

- Enable request/stream logging:

```env
DEBUG=true
```

- Standalone probes (outside the AI SDK):
  - `pnpm test:berget:tools` — sends a single request with a function tool
  - `pnpm scan:berget:tools` — tests all models listed in `docs/external/berget-ai-models.json` for tool support
  - `pnpm test:berget:streaming` — verifies GPT‑OSS streaming works correctly (273+ deltas expected)

Notes & limitations

- Tool behavior depends on the specific Berget endpoint for a model; GPT‑OSS currently rejects tools on Berget even though the base model may support tools elsewhere.
- Tool schemas are defined inline in `lib/ai/tools/` and automatically registered with the AI SDK.

### Add another Berget model

Follow these steps to add a new chat model backed by Berget AI. This ensures the model is selectable in the UI, allowed by the API schema, and properly configured.

1) Register the model with the provider

- File: `lib/ai/providers.ts`
- Add a new entry under `languageModels` using the `bergetAiProvider` (OpenAI‑compatible provider).
- If the model supports reasoning via `<think>` tags, wrap it with `extractReasoningMiddleware`.
  
  Example (Qwen3 32B with reasoning):
  ```ts
  'qwen3-32b': withDebug(
    wrapLanguageModel({
      model: bergetAiProvider('Qwen/Qwen3-32B'),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    }),
    'berget-ai:Qwen/Qwen3-32B',
  ),
  ```
  
  Example (Llama 3.3 70B without reasoning):
  ```ts
  'llama-chat': withDebug(
    bergetAiProvider('meta-llama/Llama-3.3-70B-Instruct'),
    'berget-ai:meta-llama/Llama-3.3-70B-Instruct',
  ),
  ```

2) Allow the model in the chat request schema

- File: `app/(chat)/api/chat/schema.ts`
- Add the model id to the `selectedChatModel` enum so the request is accepted by the API route.
  ```ts
  selectedChatModel: z.enum([
    'chat-model',
    'chat-model-reasoning',
    'deepseek-r1',
    'openai-gpt-oss-120b',
    'llama-chat',
    'mistral-chat',
    'qwen3-32b', // <- new
  ]),
  ```

3) Expose the model in the UI selector

- File: `lib/ai/models.ts`
- Add an entry to `chatModels` with `id`, `name`, and `description` so it appears in the model dropdown.
  ```ts
  {
    id: 'qwen3-32b',
    name: 'Qwen3 32B (via Berget AI)',
    description: 'Qwen3 32B model via Berget AI - strong reasoning and tool use',
  },
  ```

4) Verify with the probe scripts

- Run the standalone probe against Berget to confirm behavior before and after wiring:
  ```bash
  # Single request with a function tool
  BERGET_AI_API_KEY=sk-... pnpm test:berget:tools -- --model Qwen/Qwen3-32B --tools

  # Scan all known Berget models listed in docs/external/berget-ai-models.json
  BERGET_AI_API_KEY=sk-... pnpm scan:berget:tools
  ```

5) Environment

- Ensure `BERGET_AI_API_KEY` is set in the runtime environment:
  ```env
  BERGET_AI_API_KEY=your_api_key
  ```

That’s it—after these edits the model will be selectable, requests will validate, and tools will be sent only when the model/endpoint actually supports them.

