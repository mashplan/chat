import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModelV2Middleware } from '@ai-sdk/provider';
// import { gateway } from '@ai-sdk/gateway';
import { isDebugEnabled, isTestEnvironment } from '../constants';

// Create OpenAI instance with explicit configuration
const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Validate Berget AI API key
if (!isTestEnvironment && !process.env.BERGET_AI_API_KEY) {
  console.warn(
    'BERGET_AI_API_KEY is not set. Berget AI models will not be available.',
  );
}

// Berget AI provider configuration (no custom fetch – Berget custom provider handles logic)
const bergetAiProvider = createOpenAICompatible({
  name: 'berget-ai',
  apiKey: process.env.BERGET_AI_API_KEY || 'dummy-key-for-tests',
  baseURL: 'https://api.berget.ai/v1',
  includeUsage: true,
});

// Scaleway provider configuration
const scalewayBaseURL =
  process.env.SCALEWAY_AI_BASE_URL || 'https://api.scaleway.ai/v1';
const scalewayProvider = createOpenAICompatible({
  name: 'scaleway',
  apiKey: process.env.SCALEWAY_AI_API_KEY || 'dummy-key-for-tests',
  baseURL: scalewayBaseURL,
  includeUsage: true,
});

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require('./models.mock');
      return customProvider({
        languageModels: {
          'chat-model': chatModel,
          'chat-model-reasoning': reasoningModel,
          'title-model': titleModel,
          'artifact-model': artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        'chat-model': anthropic('claude-sonnet-4-20250514'),
        'chat-model-reasoning': wrapLanguageModel({
          model: bergetAiProvider('unsloth/MAI-DS-R1-GGUF'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': withDebug(
          bergetAiProvider('mistralai/Magistral-Small-2506'),
          'berget-ai:mistralai/Magistral-Small-2506',
        ),
        'artifact-model': anthropic('claude-sonnet-4-20250514'),
        // Berget AI models
        'deepseek-r1': withDebug(
          wrapLanguageModel({
            model: bergetAiProvider('unsloth/MAI-DS-R1-GGUF'),
            middleware: extractReasoningMiddleware({ tagName: 'think' }),
          }),
          'berget-ai:unsloth/MAI-DS-R1-GGUF',
        ),
        'openai-gpt-oss-120b': withDebug(
          wrapLanguageModel({
            model: bergetAiProvider('openai/gpt-oss-120b'),
            middleware: extractReasoningMiddleware({ tagName: 'think' }),
          }),
          'berget-ai:openai/gpt-oss-120b',
        ),
        'llama-chat': withDebug(
          bergetAiProvider('meta-llama/Llama-3.3-70B-Instruct'),
          'berget-ai:meta-llama/Llama-3.3-70B-Instruct',
        ),
        'mistral-chat': withDebug(
          bergetAiProvider('mistralai/Magistral-Small-2506'),
          'berget-ai:mistralai/Magistral-Small-2506',
        ),
        // Qwen 3 32B via Berget AI
        'qwen3-32b': withDebug(
          wrapLanguageModel({
            model: bergetAiProvider('Qwen/Qwen3-32B'),
            middleware: extractReasoningMiddleware({ tagName: 'think' }),
          }),
          'berget-ai:Qwen/Qwen3-32B',
        ),
        // Scaleway models
        'scaleway-gpt-oss-120b': withDebug(
          scalewayProvider('gpt-oss-120b'),
          'scaleway:gpt-oss-120b',
        ),
        'scaleway-qwen3-235b': withDebug(
          scalewayProvider('qwen3-235b-a22b-instruct-2507'),
          'scaleway:qwen3-235b-a22b-instruct-2507',
        ),
      },
      imageModels: {
        'small-model': openaiProvider.imageModel('dall-e-3'),
      },
    });

// Export raw Berget AI provider for debugging endpoints
export const bergetAi = bergetAiProvider;

// Internal: wrap a model with debug logging if DEBUG is enabled
function withDebug(model: any, label: string) {
  if (!isDebugEnabled) return model;
  return wrapLanguageModel({
    model,
    middleware: createDebugMiddleware(label),
  });
}

function createDebugMiddleware(label: string): LanguageModelV2Middleware {
  const safeJson = (obj: unknown) => {
    try {
      return JSON.stringify(obj);
    } catch {
      try {
        return JSON.stringify(obj, (_k, v) =>
          typeof v === 'bigint' ? v.toString() : v,
        );
      } catch {
        return '[unserializable]';
      }
    }
  };

  return {
    wrapGenerate: async ({ doGenerate, params }) => {
      try {
        console.log(
          `[DEBUG][${label}] generate params:`,
          summarizeParams(params),
        );
      } catch {}

      const result = await doGenerate();

      try {
        console.log(`[DEBUG][${label}] generate result:`, safeJson(result));
      } catch {}

      return result;
    },

    wrapStream: async ({ doStream, params }) => {
      try {
        console.log(
          `[DEBUG][${label}] stream params:`,
          summarizeParams(params),
        );
      } catch {}

      const { stream, request, response } = await doStream();

      try {
        if (request) {
          const rq = request as unknown as {
            headers?: Headers;
            method?: string;
            url?: string;
          };
          const headers: Record<string, string> = {};
          rq.headers?.forEach((value: string, key: string) => {
            if (key.toLowerCase() === 'authorization') return;
            headers[key] = value;
          });
          console.log(`[DEBUG][${label}] request:`, {
            url: rq.url,
            method: rq.method,
            headers,
          });
        } else {
          console.log(`[DEBUG][${label}] request: none`);
        }
        if (response) {
          const rs = response as unknown as Response;
          console.log(`[DEBUG][${label}] response:`, {
            status: (rs as any).status,
            statusText: (rs as any).statusText,
          });
        } else {
          console.log(`[DEBUG][${label}] response: none`);
        }
      } catch {}

      const transformed = new ReadableStream<any>({
        start: async (controller) => {
          const reader = stream.getReader();
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            try {
              console.log(`[DEBUG][${label}] stream part:`, safeJson(value));
            } catch {}
            controller.enqueue(value);
          }
          controller.close();
        },
      });

      return { stream: transformed, request, response };
    },
  };
}

function summarizeParams(params: unknown) {
  try {
    const p = params as any;
    return {
      hasSystem: typeof p?.system === 'string',
      messagesLength: Array.isArray(p?.messages)
        ? p.messages.length
        : undefined,
      toolCount: p?.tools ? Object.keys(p.tools).length : 0,
    };
  } catch {
    return {};
  }
}
