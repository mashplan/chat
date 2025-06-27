import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';

// Create OpenAI instance with explicit configuration
const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: 'strict',
});

// Validate Berget AI API key
if (!isTestEnvironment && !process.env.BERGET_AI_API_KEY) {
  console.warn(
    'BERGET_AI_API_KEY is not set. Berget AI models will not be available.',
  );
}

// Berget AI provider configuration
const bergetAiProvider = createOpenAI({
  apiKey: process.env.BERGET_AI_API_KEY || 'dummy-key-for-tests',
  baseURL: 'https://api.berget.ai/v1',
  compatibility: 'compatible',
  fetch: async (url, options) => {
    // Check if API key is missing
    if (!process.env.BERGET_AI_API_KEY) {
      throw new Error(
        'BERGET_AI_API_KEY environment variable is required to use Berget AI models. ' +
          'Please set your Berget AI API key in your environment variables.',
      );
    }

    const response = await fetch(url, options);

    // Log error details if request failed
    if (!response.ok) {
      const errorText = await response.text();

      // Provide more helpful error messages
      if (response.status === 401) {
        throw new Error(
          'Invalid Berget AI API key. Please check your BERGET_AI_API_KEY environment variable.',
        );
      } else if (response.status === 403) {
        throw new Error(
          'Berget AI API access forbidden. Please check your API key permissions.',
        );
      } else if (response.status === 429) {
        throw new Error(
          'Berget AI API rate limit exceeded. Please try again later.',
        );
      } else {
        throw new Error(
          `Berget AI API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
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
        'deepseek-chat': bergetAiProvider('meta-llama/Llama-3.3-70B-Instruct'),
      },
      imageModels: {
        'small-model': openaiProvider.image('dall-e-3'),
      },
    });
