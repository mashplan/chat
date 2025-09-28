import { isMultiModelChooseEnabled } from '@/lib/constants';

export const FORCED_CHAT_MODEL_ID: string = 'openai-gpt-oss-120b';
export const DEFAULT_CHAT_MODEL: string = isMultiModelChooseEnabled
  ? 'chat-model'
  : FORCED_CHAT_MODEL_ID;

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model',
    name: 'Claude Sonnet 4',
    description: 'Advanced multimodal model from Anthropic',
  },
  // {
  //   id: 'chat-model-reasoning',
  //   name: 'DeepSeek R1 (via Berget AI)',
  //   description:
  //     'DeepSeek R1 reasoning model via Berget AI - excellent for math, coding, and complex reasoning tasks',
  // },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1 (via Berget AI)',
    description:
      'DeepSeek R1 reasoning model via Berget AI - excellent for math, coding, and complex reasoning tasks',
  },
  {
    id: 'openai-gpt-oss-120b',
    name: 'OpenAI GPT-OSS 120B (via Berget AI)',
    description:
      'OpenAI GPT-OSS 120B model via Berget AI - powerful open-source model with strong reasoning capabilities',
  },
  {
    id: 'scaleway-gpt-oss-120b',
    name: 'GPT-OSS 120B (via Scaleway)',
    description:
      'Open-source GPT-OSS 120B served via Scaleway Generative APIs - OpenAI-compatible',
  },
  {
    id: 'scaleway-qwen3-235b',
    name: 'Qwen3 235B (via Scaleway)',
    description:
      'Qwen3 235B model via Scaleway Generative APIs - OpenAI-compatible',
  },
  {
    id: 'llama-chat',
    name: 'Llama 3.3 70B (via Berget AI)',
    description:
      'Llama 3.3 70B Instruct model via Berget AI - general purpose conversational AI',
  },
  {
    id: 'mistral-chat',
    name: 'Mistral Magistral Small 2506 (via Berget AI)',
    description:
      'Mistral Magistral Small 2506 model via Berget AI - fast and efficient',
  },
  {
    id: 'qwen3-32b',
    name: 'Qwen3 32B (via Berget AI)',
    description:
      'Qwen3 32B model via Berget AI - strong reasoning and tool use',
  },
];
