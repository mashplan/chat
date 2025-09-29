'use server';

import { generateText, type UIMessage } from 'ai';
import { cookies } from 'next/headers';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
} from '@/lib/db/queries';
import type { VisibilityType } from '@/components/visibility-selector';
import { myProvider } from '@/lib/ai/providers';
import { getTextFromMessage } from '@/lib/utils';

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const system = `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`;

  async function generateWithModel(modelId: string) {
    const { text } = await generateText({
      model: myProvider.languageModel(modelId),
      system,
      prompt: JSON.stringify(message),
    });
    return text;
  }

  // Try primary title model → fallback to Llama → final local fallback
  try {
    return await generateWithModel('title-model');
  } catch (primaryError) {
    console.warn(
      '[title] primary model failed, falling back to llama-chat',
      primaryError,
    );
    try {
      return await generateWithModel('llama-chat');
    } catch (fallbackError) {
      console.warn(
        '[title] fallback model failed, using local title',
        fallbackError,
      );
      const localTitle = buildLocalTitleFromMessage(message);
      return localTitle;
    }
  }
}

function buildLocalTitleFromMessage(message: UIMessage) {
  try {
    const raw = getTextFromMessage(message as any) || '';
    const sanitized = raw
      .replace(/["'“”‘’]/g, '')
      .replace(/[:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const fallback = sanitized || 'New chat';
    return fallback.length <= 80 ? fallback : `${fallback.slice(0, 77)}...`;
  } catch {
    return 'New chat';
  }
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}
