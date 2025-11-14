# AI SDK 6 Beta Upgrade - Tool Calling with Reasoning Models

## Upgrade Summary

**Date:** November 2025  
**AI SDK Version:** 6.0.0-beta.94  
**Status:** Tool calling now enabled for all models, including reasoning models

## What Changed

### 1. Tool Calling Now Works with Reasoning Models

Previously, the chat API explicitly disabled tool calling for reasoning models to work around compatibility issues:

```typescript
// OLD CODE (disabled tools for reasoning models)
experimental_activeTools:
  effectiveModelId === 'chat-model-reasoning' ||
  effectiveModelId === 'deepseek-r1'
    ? []
    : [/* tools */]
```

This restriction has been **removed**. Tool calling is now enabled for all models:

```typescript
// NEW CODE (tools enabled for all models)
experimental_activeTools: [
  'getWeather',
  'searchWeb',
  'scrapeUrl',
  'createDocument',
  'updateDocument',
  'requestSuggestions',
  'generateImageTool',
]
```

### 2. Models with Tool Support

The following Berget AI models now support tool calling:

✅ **Reasoning Models (with AI SDK 6 Beta):**
- `openai-gpt-oss-120b` — Fixed by Berget AI (Nov 2025)
- `deepseek-r1` (unsloth/MAI-DS-R1-GGUF)
- `qwen3-32b` (Qwen/Qwen3-32B)

✅ **Non-Reasoning Models:**
- `llama-chat` (meta-llama/Llama-3.3-70B-Instruct)
- `mistral-chat` (mistralai/Magistral-Small-2506)
- And others

## Critical Fix: Step Count for Reasoning Models with Tools

### The Problem

Previously, the code used `stopWhen: stepCountIs(5)` for all models. With reasoning models, a single "step" can be just a thinking/reasoning block. This meant:

1. Model spends steps 1-5 on reasoning (`<think>` tags)
2. Model never reaches the tool-calling phase
3. Model times out without producing an answer
4. User sees incomplete reasoning but no final response

### The Solution

**Reasoning models now use `stepCountIs(20)` instead of `stepCountIs(5)`**

This allows:
- Steps 1-N: Reasoning/thinking (extracts as `<think>` blocks)
- Steps N+1-M: Tool calls (getWeather, searchWeb, etc.)
- Steps M+1-O: Tool results are fed back
- Steps O+1-20: Final answer generation

Non-reasoning models continue to use 5 steps since they go directly to tool use and answer.

## AI SDK 6 Beta Features Leveraged

### 1. **Tool Execution Approval** (New)

Reason models can now request approval before executing tools. This is useful for sensitive operations like document updates or payments.

```typescript
// Example: Mark a tool as requiring approval
export const updateDocument = tool({
  description: 'Update a document',
  inputSchema: z.object({ /* ... */ }),
  needsApproval: true, // User must approve before execution
  execute: async (input) => { /* ... */ },
});
```

### 2. **Structured Output with Tool Calling** (Stable in SDK 6)

Reasoning models can now generate both tool calls AND structured output in a single request. This wasn't possible before.

```typescript
// Tools + structured output (now supported)
const result = await streamText({
  model: reasoningModel,
  tools: { /* ... */ },
  output: Output.object({
    schema: z.object({
      summary: z.string(),
      recommendation: z.string(),
    }),
  }),
  stopWhen: stepCountIs(5), // Allow tool loop + output generation
});
```

### 3. **Language Model v3 Middleware API**

AI SDK 6 Beta introduces the Language Model v3 middleware specification. Custom middleware now uses `specificationVersion: 'v3'`:

```typescript
function createDebugMiddleware(label: string): LanguageModelMiddleware {
  return {
    specificationVersion: 'v3' as const,
    wrapGenerate: async ({ doGenerate, params }) => {
      // Pre/post processing for generate calls
      return await doGenerate();
    },
    wrapStream: async ({ doStream, params }) => {
      // Pre/post processing for stream calls
      const { stream, request, response } = await doStream();
      return { stream, request, response };
    },
  };
}
```

**Key differences from v2:**
- `wrapGenerate` and `wrapStream` replace single `wrapCall` method
- More granular control over generate vs stream operations
- Better integration with tool calling and reasoning extraction

### 4. **Better Reasoning Middleware Integration**

The `extractReasoningMiddleware` now works seamlessly with tool calling, allowing:
- Reasoning to appear in UI as thinking blocks
- Tool calls to be executed during reasoning (for models that support it)
- Results fed back into the reasoning loop

**Note:** Some endpoints (like Berget AI's GPT-OSS 120B) don't support native tool calling even with middleware. These use a server-side fallback flow (see `docs/SOLUTION_REASONING_TOOLS.md`).

## Implementation Details

### Files Modified

1. **`app/(chat)/api/chat/route.ts`**
   - Removed conditional tool disabling for reasoning models
   - All models now use the same tool configuration (except fallback models)
   - **Increased `stopWhen` step count to 20 for reasoning models** (was 5)
     - Reasoning models need more steps to: think → call tools → process results → answer
     - Non-reasoning models still use 5 steps
     - This prevents reasoning models from "using up" all steps on just thinking
   - **Implemented fallback flow for GPT-OSS 120B** (preflight intent detection)
     - Models in `fallbackSearchIntentModels` use server-side tool execution
     - See `docs/SOLUTION_REASONING_TOOLS.md` for details

2. **`lib/ai/providers.ts`**
   - Updated debug middleware to use Language Model v3 API (`specificationVersion: 'v3'`)
   - Reasoning models still use `extractReasoningMiddleware` (works with tools for supported endpoints)
   - Debug middleware now uses `wrapGenerate` and `wrapStream` instead of single `wrapCall`

3. **`lib/constants.ts`**
   - Added `fallbackSearchIntentModels` list for models needing server-side tool fallback

4. **`lib/ai/prompts.ts`**
   - Added search/scrape intent instructions for fallback models

5. **`docs/berget-ai.md`**
   - Updated model capabilities list
   - Noted Berget AI fix for GPT-OSS 120B streaming (Nov 2025)
   - Documented AI SDK 6 Beta enabling reasoning + tools
   - Documented fallback flow for GPT-OSS 120B

### Key Files (No Changes Needed)

- **`lib/ai/models.ts`** — Model definitions remain the same
- **`app/(chat)/api/chat/schema.ts`** — Schema validation unchanged

## Testing Recommendations

1. **Test Reasoning Models with Tools:**
   ```bash
   # Use the chat API with:
   # - Model: openai-gpt-oss-120b or deepseek-r1
   # - Prompt: "What's the weather in San Francisco?"
   # Expected: Tool call to getWeather + reasoning shown
   ```

2. **Verify Reasoning UI:**
   - Check that `<think>` tags are extracted and shown as thinking blocks
   - Verify tool calls appear alongside reasoning

3. **Run Existing Tests:**
   ```bash
   pnpm test
   pnpm test:berget:tools
   pnpm scan:berget:tools
   ```

## Migration Notes for Other Reasoning Models

If you want to add another reasoning model that uses `<think>` tags:

1. Register in `lib/ai/providers.ts`:
   ```typescript
   'my-model': wrapLanguageModel({
     model: bergetAiProvider('provider/model-name'),
     middleware: extractReasoningMiddleware({ tagName: 'think' }),
   }),
   ```

2. Add to `app/(chat)/api/chat/schema.ts` enum
3. Add to `lib/ai/models.ts` chat models list
4. **If the endpoint doesn't support native tool calling:**
   - Add model ID to `fallbackSearchIntentModels` in `lib/constants.ts`
   - Add intent instructions to system prompt in `lib/ai/prompts.ts`
   - Tools will execute server-side via fallback flow
5. **If the endpoint supports native tool calling:**
   - Tools will work automatically with the new setup
   - No additional configuration needed

## Backward Compatibility

✅ **No breaking changes** — AI SDK 6 is designed for smooth migration from v5

- Existing chat flows continue to work
- Tool calling behavior is additive (previously disabled, now enabled)
- Reasoning extraction middleware continues to work as before

## References

- [AI SDK 6 Beta Announcement](https://v6.ai-sdk.dev/docs/announcing-ai-sdk-6-beta)
- [Structured Output with Tool Calling](https://v6.ai-sdk.dev/docs/announcing-ai-sdk-6-beta#structured-output-stable)
- [Tool Execution Approval](https://v6.ai-sdk.dev/docs/announcing-ai-sdk-6-beta#tool-execution-approval)
- [Language Model Middleware v3](https://v6.ai-sdk.dev/docs/guides/middleware) - New middleware API specification
- `docs/SOLUTION_REASONING_TOOLS.md` - Detailed explanation of fallback flow for GPT-OSS 120B

