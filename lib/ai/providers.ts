import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { extractHarmonyReasoningMiddleware } from './middleware/harmony-reasoning';
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
const bergetAiProvider = createOpenAICompatible({
  name: 'berget-ai',
  apiKey: process.env.BERGET_AI_API_KEY || 'dummy-key-for-tests',
  baseURL: 'https://api.berget.ai/v1',
  fetch: async (url, options) => {
    const response = await fetch(url, options);

    // Check for streaming errors in the response
    if (
      response.ok &&
      response.headers.get('content-type')?.includes('text/event-stream')
    ) {
      const clonedResponse = response.clone();
      const reader = clonedResponse.body?.getReader();

      if (reader) {
        const decoder = new TextDecoder();
        try {
          const { value, done } = await reader.read();
          if (!done && value) {
            const chunk = decoder.decode(value);
            // Check if the chunk contains an error
            if (chunk.includes('"error"')) {
              try {
                const errorData = JSON.parse(chunk);
                if (errorData.error) {
                  console.error('[BERGET AI] API Error:', errorData.error);
                  // Throw a proper error that the AI SDK can handle
                  throw new Error(
                    `Berget AI Error: ${errorData.error.message} (${errorData.error.code})`,
                  );
                }
              } catch (parseError) {
                // If it's not valid JSON, continue normally
              }
            }
          }
        } catch (error) {
          console.error('[BERGET AI] Stream error:', error);
          throw error;
        } finally {
          reader.releaseLock();
        }
      }
    }

    return response;
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
        'deepseek-r1': wrapLanguageModel({
          model: bergetAiProvider('unsloth/MAI-DS-R1-GGUF'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'openai-gpt-oss-120b': wrapLanguageModel({
          model: bergetAiProvider('openai/gpt-oss-120b'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'llama-chat': bergetAiProvider('meta-llama/Llama-3.3-70B-Instruct'),
      },
      imageModels: {
        'small-model': openaiProvider.imageModel('dall-e-3'),
      },
    });
