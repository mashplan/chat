### Berget AI Integration

This app includes optional integration with [Berget AI](https://api.berget.ai/) via the AI SDK’s OpenAI‑compatible provider.

Models exposed:
- `deepseek-r1` → `unsloth/MAI-DS-R1-GGUF` (reasoning)
- `openai-gpt-oss-120b` → `openai/gpt-oss-120b` (reasoning with Harmony tags)
- `llama-chat` → `meta-llama/Llama-3.3-70B-Instruct`

Configuration:

```env
BERGET_AI_API_KEY=your_api_key
```

Once set, models appear in the UI automatically. If `BERGET_AI_API_KEY` is not provided, Berget models are hidden and a warning is logged during startup.

Implementation reference: `lib/ai/providers.ts`.


