export const DEFAULT_CHAT_MODEL: string = 'chat-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model',
    name: 'Chat model',
    description: 'Primary model for all-purpose chat',
  },
  {
    id: 'chat-model-reasoning',
    name: 'Reasoning model',
    description: 'Uses advanced reasoning',
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1 (via Berget AI)',
    description:
      'DeepSeek R1 reasoning model via Berget AI - excellent for math, coding, and complex reasoning tasks',
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat (via Berget AI)',
    description:
      'DeepSeek V3 chat model via Berget AI - general purpose conversational AI',
  },
];
