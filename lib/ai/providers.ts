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
const bergetAiProvider = createOpenAICompatible({
  name: 'berget-ai',
  apiKey: process.env.BERGET_AI_API_KEY || 'dummy-key-for-tests',
  baseURL: 'https://api.berget.ai/v1',
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
        'llama-chat': bergetAiProvider('meta-llama/Llama-3.3-70B-Instruct'),
      },
      imageModels: {
        'small-model': openaiProvider.imageModel('dall-e-3'),
      },
    });
