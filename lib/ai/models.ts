export const DEFAULT_CHAT_MODEL: string = 'chat-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model',
    name: 'Grok Vision',
    description: 'Advanced multimodal model with vision and text capabilities',
  },
  {
    id: 'chat-model-reasoning',
    name: 'Grok Reasoning',
    description: 'Uses advanced chain-of-thought reasoning for complex problems',
  },
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
    id: 'llama-chat',
    name: 'Llama 3.3 70B (via Berget AI)',
    description:
      'Llama 3.3 70B Instruct model via Berget AI - general purpose conversational AI',
  },
  {
    id: 'mistral-chat',
    name: 'Mistral Magistral Small 2506 (via Berget AI)',
    description:
      'Mistral Magistral Small 2506 model via Berget AI - fast and efficient with excellent tool support',
  },
];
