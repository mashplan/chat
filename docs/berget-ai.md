### Berget AI Integration

This app integrates [Berget AI](https://api.berget.ai/) using a custom provider that implements the AI SDK v2 specification.

Configuration

```env
BERGET_AI_API_KEY=your_api_key
```

Key files

- `lib/ai/providers/berget-provider.ts` — custom provider (payload shaping, tool support, reasoning extraction, stream synthesis)
- `lib/ai/providers.ts` — wires Berget models to the custom provider

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

- If Berget responds with SSE in an unexpected shape, the provider can synthesize a stream from a non‑streaming JSON response so the UI still renders deltas.

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


