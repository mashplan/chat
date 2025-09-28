## Add a new AI provider and model

This guide documents the exact steps and files to modify when integrating a new AI provider/model into the chat app. Follow this checklist to avoid missing a step.

### Prerequisites
- Decide the provider API style:
  - OpenAI-compatible (preferred): use `createOpenAICompatible`.
  - Native SDK: use provider-specific SDK or `createOpenAI`/other wrappers.
- Gather credentials and base URL(s).
  - Add to `.env.local`:
    - `PROVIDER_API_KEY=...`
    - Optional: `PROVIDER_BASE_URL=...` (use project/deployment-scoped URL if required)
- Optional feature flags and debugging:
  - `FEATURE_MULTI_MODEL_CHOOSE=true` to allow switching models in the UI.
  - `DEBUG=1` to enable request/response debug logs for models wrapped with debug middleware.

### Naming conventions
- Use a provider-prefixed internal model id so collisions are obvious, e.g. `scaleway-gpt-oss-120b`, `berget-llama-70b`, `openrouter-qwen2.5`.
- The internal id appears in multiple places: provider mapping, UI model list, entitlements, and the API schema enum.

### Files to update (required)
1) `lib/ai/providers.ts`
   - Create the provider instance (OpenAI-compatible recommended):

```ts
// Example
const providerBaseURL = process.env.PROVIDER_BASE_URL || 'https://api.example.com/v1';
const providerX = createOpenAICompatible({
  name: 'provider-x',
  apiKey: process.env.PROVIDER_API_KEY || 'dummy-key-for-tests',
  baseURL: providerBaseURL,
  includeUsage: true,
});

// Register the model id in languageModels
'providerx-model-id': withDebug(
  providerX('remote-model-name'),
  'provider-x:remote-model-name',
),
```

2) `lib/ai/models.ts`
   - Add an entry to `chatModels` with the new internal id and a user-facing name/description.

```ts
{
  id: 'providerx-model-id',
  name: 'Model Name (via ProviderX)',
  description: 'Short human-readable description of the model',
},
```

   - Optionally adjust `FORCED_CHAT_MODEL_ID` if you want this to be the default when multi-model choose is disabled.

3) `lib/ai/entitlements.ts`
   - Add the new id to `availableChatModelIds` for each relevant user type (e.g., `guest`, `regular`).

```ts
'providerx-model-id',
```

4) `app/(chat)/api/chat/schema.ts`
   - Add the new id to the `selectedChatModel` enum. Missing this will cause server-side 400s on POST `/api/chat`.

```ts
'providerx-model-id',
```

5) `app/(chat)/api/chat/route.ts`
   - Tools and provider options:
     - Decide whether to allow tools initially; for smoke testing, you can disable tools for the new model by adding the id to the `experimental_activeTools` exclusion list.
     - If the provider is OpenAI-compatible and supports function calling, ensure `toolChoice: 'auto'` and set `providerOptions.openai.tool_choice = 'auto'` (or provider-specific override if needed).

```ts
// Example gating tools for early text-only validation
experimental_activeTools:
  effectiveModelId === 'providerx-model-id'
    ? []
    : [
        'getWeather',
        'searchWeb',
        'scrapeUrl',
        'createDocument',
        'updateDocument',
        'requestSuggestions',
        'generateImageTool',
      ],
```

### Optional: Health-check route
- Add a simple endpoint to verify connectivity and credentials before wiring tools:

File: `app/api/health/<provider>/route.ts`

```ts
import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.PROVIDER_API_KEY;
  const baseURL = process.env.PROVIDER_BASE_URL || 'https://api.example.com/v1';
  const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;

  if (!apiKey) return NextResponse.json({ ok: false, error: 'Missing key' }, { status: 500 });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'remote-model-name',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello in one short sentence.' },
      ],
      max_tokens: 32,
      stream: false,
    }),
  });

  const text = await res.text();
  return NextResponse.json({ ok: res.ok, status: res.status, endpoint: url, raw: safeParseJson(text), rawText: text }, { status: res.ok ? 200 : res.status });
}

function safeParseJson(text: string) { try { return JSON.parse(text); } catch { return null; } }
```

### Enabling function calling (tools)
- Once text-only chat is working, enable tools for your model:
  - Remove the model id from the tools exclusion in `route.ts`.
  - Ensure the provider supports OpenAI-style `tools` and `tool_choice`.
  - Our built-in tools live in `lib/ai/tools/*` (e.g., `search-web`, `scrape-url`).
  - Keep `toolChoice: 'auto'` in the `streamText` call and pass `tools: { ... }` as we do for other models.

### Debugging
- Set `DEBUG=1` to log generate/stream parameters and responses for models wrapped with `withDebug`.
- If POST `/api/chat` returns 400, check the Zod schema enum (`selectedChatModel`) first.
- Use the health-check endpoint to confirm credentials and correct base URL.

### Testing and QA
- Run:
  - `pnpm format`
  - `pnpm lint`
  - Optional: E2E tests (`tests/e2e`) if applicable
- Manual test:
  - Toggle `FEATURE_MULTI_MODEL_CHOOSE=true`.
  - Select your new model in the chat UI.
  - Send a short prompt; verify streaming response and usage metrics.

### Production checklist
- Environment variables set in your deployment platform.
- Model accessible to the service account/key in the configured region/project.
- Reasonable default timeouts and retry policies handled on provider side.
- If enabling tools, verify function-calling quotas/limits.

### Example: Scaleway GPT-OSS 120B summary
- Provider: `createOpenAICompatible` with `name: 'scaleway'`.
- Env:
  - `SCALEWAY_AI_API_KEY`
  - `SCALEWAY_AI_BASE_URL` (project-scoped endpoint recommended)
- Model mapping in `providers.ts`:
  - `'scaleway-gpt-oss-120b': scalewayProvider('gpt-oss-120b')`
- UI model entry in `lib/ai/models.ts` and entitlement update.
- Add id to `selectedChatModel` enum in `app/(chat)/api/chat/schema.ts`.
- Start with tools disabled for smoke test; enable later when ready.


