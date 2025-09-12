### Berget AI Integration

This app integrates [Berget AI](https://api.berget.ai/) using a custom provider that implements the AI SDK v2 specification.

Configuration

```env
BERGET_AI_API_KEY=your_api_key
```

Key files

- `lib/ai/providers/berget-provider.ts` — custom provider (payload shaping, tool support, reasoning extraction, stream synthesis)
- `lib/ai/providers.ts` — currently wires most Berget models via OpenAI‑compatible provider; OpenAi OSS model is routed through the custom provider for fallback synthesis.

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

- Some endpoints (e.g., GPT‑OSS) embed pseudo‑reasoning inside the text (e.g., `<think>…</think>` or `analysis … assistantfinal …`). The provider extracts this and emits AI SDK reasoning parts so the UI shows a proper “thinking” block, similar to DeepSeek R1.

Streaming

- If Berget responds with SSE in an unexpected shape, the custom provider can synthesize a stream from a non‑streaming JSON response so the UI still renders deltas.

Model routing and current behavior

- Llama 3.3 70B and Magistral Small 2506: use the OpenAI‑compatible provider; stream text normally; reasoning is handled by middleware.
- Qwen3 32B: OpenAI‑compatible provider; streams thinking and text; reasoning middleware extracts `<think>` when present.
- OpenAI GPT‑OSS 120B: uses the custom Berget provider with a non‑streaming fallback and synthesized stream because the OpenAI‑compatible path frequently emits only `finish` without deltas. UI workaround added to allow follow‑ups if a stream gets stuck.

Known limitation (OSS)

- On OpenAI‑compatible streaming, GPT‑OSS sometimes sends a `finish` without any prior deltas, which can leave clients waiting. We added:
  - Provider fallback: if no deltas arrive, perform a non‑streaming request and synthesize reasoning/text.
  - UI workaround: when submitting a follow‑up on OSS while status is not `ready`, we call `stop()` then immediately submit to clear any stale stream state.
  - A support ticket (`docs/support-tickets/berget-oss-streaming-ticket.md`) requesting standardized streaming for OSS.

Debugging & scripts

- Enable request/stream logging:

```env
DEBUG=true
```

- Standalone probes (outside the AI SDK):
  - `pnpm test:berget:tools` — sends a single request with a function tool
  - `pnpm scan:berget:tools` — tests all models listed in `docs/external/berget-ai-models.json` for tool support

Notes & limitations

- Tool behavior depends on the specific Berget endpoint for a model; GPT‑OSS currently rejects tools on Berget even though the base model supports tools elsewhere.
- If you add new project tools, extend the mapper in `buildBergetToolSchemas` inside `berget-provider.ts`.

### Add another Berget model

Follow these steps to add a new chat model backed by Berget AI. This ensures the model is selectable in the UI, allowed by the API schema, wired to the custom provider, and—if supported—receives tool schemas.

1) Register the model with the provider

- File: `lib/ai/providers.ts`
- Add a new entry under `languageModels` using `new BergetChatLanguageModel('<BERGET_MODEL_ID>', { baseURL: 'https://api.berget.ai/v1', provider: 'berget-ai', headers: () => ({ Authorization: `Bearer ${process.env.BERGET_AI_API_KEY ?? ''}` }) })`.
  Example (Qwen3 32B):
  ```ts
  'qwen3-32b': new BergetChatLanguageModel('Qwen/Qwen3-32B', {
    baseURL: 'https://api.berget.ai/v1',
    provider: 'berget-ai',
    headers: () => ({
      Authorization: `Bearer ${process.env.BERGET_AI_API_KEY ?? ''}`,
    }),
  }) as any,
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

4) Gate tool-calling support (only for models that truly support tools)

- File: `lib/ai/providers/berget-provider.ts`
- Add the Berget model id to `TOOL_SUPPORTED_MODELS` if and only if tool calling works for that endpoint. If tools are not supported, do not add it—the provider will automatically omit `tools/functions` to avoid 400 errors.
  ```ts
  const TOOL_SUPPORTED_MODELS = new Set<string>([
    'meta-llama/Llama-3.1-8B-Instruct',
    'meta-llama/Llama-3.3-70B-Instruct',
    'mistralai/Devstral-Small-2505',
    'mistralai/Magistral-Small-2506',
    'Qwen/Qwen3-32B', // add here only if verified
  ]);
  ```

5) Verify with the probe scripts

- Run the standalone probe against Berget to confirm behavior before and after wiring:
  ```bash
  # Single request with a function tool
  BERGET_AI_API_KEY=sk-... pnpm test:berget:tools -- --model Qwen/Qwen3-32B --tools

  # Scan all known Berget models listed in docs/external/berget-ai-models.json
  BERGET_AI_API_KEY=sk-... pnpm scan:berget:tools
  ```
- If the model returns 400 when tools are present, remove it from `TOOL_SUPPORTED_MODELS` to disable tools for that model.

6) Environment

- Ensure `BERGET_AI_API_KEY` is set in the runtime environment:
  ```env
  BERGET_AI_API_KEY=your_api_key
  ```

That’s it—after these edits the model will be selectable, requests will validate, and tools will be sent only when the model/endpoint actually supports them.

