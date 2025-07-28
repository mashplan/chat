import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';
import { isTestEnvironment } from '../constants';

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

// Berget AI provider configuration
let requestCounter = 0;
const bergetAiProvider = createOpenAICompatible({
  name: 'berget-ai',
  apiKey: process.env.BERGET_AI_API_KEY || 'dummy-key-for-tests',
  baseURL: 'https://api.berget.ai/v1',
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestId = ++requestCounter;
    console.log(`\n=== Berget AI Request #${requestId} ===`);
    const url = typeof input === 'string' ? input : input.toString();
    console.log('URL:', url);
    console.log('Headers:', init?.headers);

    // For Berget AI, always use non-streaming
    if (init?.body && url.includes('berget.ai')) {
      try {
        const bodyStr =
          typeof init.body === 'string'
            ? init.body
            : new TextDecoder().decode(init.body as Uint8Array);

        const bodyObj = JSON.parse(bodyStr);
        console.log(`Request #${requestId} - Original stream:`, bodyObj.stream);

        // Force non-streaming
        bodyObj.stream = false;

        const modifiedInit = {
          ...init,
          body: JSON.stringify(bodyObj),
        };

        console.log(`Request #${requestId} - Making non-streaming request...`);
        const response = await fetch(input, modifiedInit);
        console.log(
          `Request #${requestId} - Response status:`,
          response.status,
        );

        // Clone response to read body
        const responseText = await response.text();
        console.log(
          `Request #${requestId} - Response body preview:`,
          responseText.substring(0, 200),
        );

        // Create a new response with the text body
        // This ensures the response can't be read as a stream
        const newResponse = new Response(responseText, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            ...Object.fromEntries(response.headers.entries()),
            'content-type': 'application/json', // Ensure it's JSON, not SSE
          },
        });

        return newResponse;
      } catch (error: any) {
        console.error(
          `Request #${requestId} - Error:`,
          error.message,
          error.code,
        );
        throw error;
      }
    }

    // Default fetch for non-Berget requests
    return fetch(input, init);
  },
});

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': anthropic('claude-sonnet-4-20250514'),
        'chat-model-reasoning': wrapLanguageModel({
          model: anthropic('claude-sonnet-4-20250514'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': anthropic('claude-sonnet-4-20250514'),
        'artifact-model': anthropic('claude-sonnet-4-20250514'),
        // Berget AI models
        /*
        'deepseek-r1': (() => {
          try {
            return wrapLanguageModel({
              model: bergetAiProvider('unsloth/MAI-DS-R1-GGUF'),
              middleware: extractReasoningMiddleware({ tagName: 'think' }),
            });
          } catch (error) {
            console.error('Error wrapping deepseek-r1 model:', error);
            return bergetAiProvider('unsloth/MAI-DS-R1-GGUF');
          }
        })(),
        */
        'llama-chat': bergetAiProvider('meta-llama/Llama-3.3-70B-Instruct'),
      },
      imageModels: {
        'small-model': openaiProvider.imageModel('dall-e-3'),
      },
    });
