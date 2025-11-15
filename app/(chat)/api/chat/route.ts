import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  type LanguageModelUsage,
  generateText,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { updateChatLastContextById } from '@/lib/db/queries';
import {
  convertToUIMessages,
  generateUUID,
  buildTruncatedTitleFromMessage,
} from '@/lib/utils';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { generateImageTool } from '@/lib/ai/tools/generate-image';
import { searchWeb } from '@/lib/ai/tools/search-web';
import { scrapeUrl } from '@/lib/ai/tools/scrape-url';
import {
  isProductionEnvironment,
  isMultiModelChooseEnabled,
  fallbackSearchIntentModels,
} from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { FORCED_CHAT_MODEL_ID } from '@/lib/ai/models';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

// --- Helper utilities for fallback search/scrape intent flow ---
const SEARCH_INTENT_REGEX = /<search_intent>([\s\S]*?)<\/search_intent>/i;
const SCRAPE_INTENT_REGEX = /<scrape_intent>([\s\S]*?)<\/scrape_intent>/i;

function extractSearchIntent(
  text: string,
): { query: string; maxResults?: number; tbs?: string | null } | null {
  try {
    const match = text.match(SEARCH_INTENT_REGEX);
    if (!match) return null;
    const json = match[1].trim();
    const intent = JSON.parse(json);
    if (typeof intent?.query === 'string') {
      return intent;
    }
    return null;
  } catch {
    return null;
  }
}

function extractScrapeIntent(text: string): {
  url: string;
  formats?: Array<'markdown' | 'html'>;
  onlyMainContent?: boolean;
} | null {
  try {
    const match = text.match(SCRAPE_INTENT_REGEX);
    if (!match) return null;
    const json = match[1].trim();
    const intent = JSON.parse(json);
    if (typeof intent?.url === 'string') {
      return intent;
    }
    return null;
  } catch {
    return null;
  }
}

function formatSearchResultsForContext(args: {
  query: string;
  results: Array<{
    title: string;
    url: string;
    description?: string;
    content?: string;
  }>;
}) {
  const lines: string[] = [];
  lines.push(`Web search results for "${args.query}":`);
  lines.push('');
  args.results.slice(0, 5).forEach((r, i) => {
    lines.push(`[${i + 1}] ${r.title || 'Untitled'} - ${r.url}`);
    if (r.description) lines.push(r.description);
    if (r.content) {
      const preview =
        r.content.length > 1200 ? `${r.content.slice(0, 1200)}…` : r.content;
      lines.push('');
      lines.push('Content preview:');
      lines.push(preview);
    }
    lines.push('');
  });
  lines.push(
    'Use the results above to answer the user. If uncertain, say what is unknown.',
  );
  return lines.join('\n');
}

function formatScrapedContentForContext(args: {
  url: string;
  content: string;
}) {
  const preview =
    args.content.length > 3000
      ? `${args.content.slice(0, 3000)}…`
      : args.content;
  return `Content scraped from ${args.url}:\n\n${preview}\n\nUse the content above to answer the user. If uncertain, say what is unknown.`;
}

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = buildTruncatedTitleFromMessage(message);

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let finalUsage: LanguageModelUsage | undefined;

    // Store tool parts outside execute scope so they're accessible in onFinish
    const toolParts: Array<{
      type: string;
      toolCallId: string;
      state: string;
      input?: any;
      output?: any;
      errorText?: string;
    }> = [];

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        const effectiveModelId = isMultiModelChooseEnabled
          ? selectedChatModel
          : (FORCED_CHAT_MODEL_ID as ChatModel['id']);
        const isReasoningModel =
          effectiveModelId === 'chat-model-reasoning' ||
          effectiveModelId === 'deepseek-r1' ||
          effectiveModelId === 'openai-gpt-oss-120b' ||
          effectiveModelId === 'qwen3-32b';
        const isSearchFallbackModel =
          fallbackSearchIntentModels.includes(effectiveModelId);

        console.log('[chat/route] Starting streamText with:');
        console.log(
          '[chat/route] Model:',
          effectiveModelId,
          '(isReasoningModel:',
          isReasoningModel,
          ')',
        );
        console.log(
          '[chat/route] Tools configured:',
          Object.keys({
            getWeather,
            searchWeb,
            scrapeUrl,
            createDocument,
            updateDocument,
            requestSuggestions,
            generateImageTool,
          }),
        );

        // Optional preflight: ask the model for search intent for fallback models
        let messagesForStream = uiMessages;

        if (isSearchFallbackModel) {
          try {
            const pre = await generateText({
              model: myProvider.languageModel(effectiveModelId),
              system: systemPrompt({
                selectedChatModel: effectiveModelId,
                requestHints,
              }),
              messages: convertToModelMessages(uiMessages),
              stopWhen: stepCountIs(5),
            });

            // Extract and stream reasoning from preflight call if present
            // The reasoning middleware extracts <think> tags, check the raw text
            const reasoningMatch = pre.text?.match(
              /<think>([\s\S]*?)<\/think>/i,
            );
            if (reasoningMatch && reasoningMatch[1]?.trim().length > 0) {
              const reasoningId = generateUUID();
              const reasoningText = reasoningMatch[1].trim();
              // Write reasoning start
              dataStream.write({
                type: 'reasoning-start',
                id: reasoningId,
              });
              // Write reasoning content as delta
              dataStream.write({
                type: 'reasoning-delta',
                id: reasoningId,
                delta: reasoningText,
              });
            }

            const intent = extractSearchIntent(pre.text || '');
            const scrapeIntent = extractScrapeIntent(pre.text || '');

            if (intent?.query) {
              console.log(
                '[chat/route] Detected search intent. Running searchWeb fallback with:',
                intent,
              );

              const toolCallId = generateUUID();
              const toolInput = {
                query: intent.query,
                maxResults: intent.maxResults ?? 5,
                tbs: intent.tbs ?? undefined,
                sources: ['web'] as const,
                categories: [] as const,
                location: undefined,
              };

              // Add tool call part with input-available state
              toolParts.push({
                type: 'tool-searchWeb',
                toolCallId,
                state: 'input-available',
                input: toolInput,
              });

              // Write tool-call event to stream for real-time display
              (dataStream as any).write({
                type: 'tool-call',
                toolCallId,
                toolName: 'searchWeb',
                input: toolInput,
              });

              let searchOutput: any;
              try {
                searchOutput = await (searchWeb as any).execute(toolInput, {});

                // Update tool part with output-available state
                toolParts[toolParts.length - 1] = {
                  type: 'tool-searchWeb',
                  toolCallId,
                  state: 'output-available',
                  input: toolInput,
                  output: searchOutput,
                };

                // Write tool-result event to stream for real-time display
                (dataStream as any).write({
                  type: 'tool-result',
                  toolCallId,
                  toolName: 'searchWeb',
                  input: toolInput,
                  output: searchOutput,
                });

                const contextText = formatSearchResultsForContext({
                  query: intent.query,
                  results: (searchOutput?.results as any[]) ?? [],
                });

                const contextMessage: ChatMessage = {
                  id: generateUUID(),
                  role: 'system',
                  parts: [
                    {
                      type: 'text',
                      text: contextText,
                    },
                  ] as any,
                  metadata: {
                    createdAt: new Date().toISOString(),
                  },
                };

                messagesForStream = [...uiMessages, contextMessage];
              } catch (searchError) {
                // Update tool part with output-error state
                toolParts[toolParts.length - 1] = {
                  type: 'tool-searchWeb',
                  toolCallId,
                  state: 'output-error',
                  input: toolInput,
                  errorText:
                    searchError instanceof Error
                      ? searchError.message
                      : String(searchError),
                };

                // Write tool error to stream for real-time display
                (dataStream as any).write({
                  type: 'tool-result',
                  toolCallId,
                  toolName: 'searchWeb',
                  input: toolInput,
                  error:
                    searchError instanceof Error
                      ? searchError.message
                      : String(searchError),
                });

                throw searchError;
              }
            }

            if (scrapeIntent?.url) {
              console.log(
                '[chat/route] Detected scrape intent. Running scrapeUrl fallback with:',
                scrapeIntent,
              );

              const toolCallId = generateUUID();
              const toolInput = {
                url: scrapeIntent.url,
                formats: scrapeIntent.formats ?? ['markdown'],
                onlyMainContent:
                  typeof scrapeIntent.onlyMainContent === 'boolean'
                    ? scrapeIntent.onlyMainContent
                    : true,
              };

              // Add tool call part with input-available state
              toolParts.push({
                type: 'tool-scrapeUrl',
                toolCallId,
                state: 'input-available',
                input: toolInput,
              });

              // Write tool-call event to stream for real-time display
              (dataStream as any).write({
                type: 'tool-call',
                toolCallId,
                toolName: 'scrapeUrl',
                input: toolInput,
              });

              try {
                const scrapeOutput: any = await (scrapeUrl as any).execute(
                  toolInput,
                  {},
                );

                const scrapedMarkdown =
                  (scrapeOutput?.content as string) ||
                  (scrapeOutput?.markdown as string) ||
                  '';
                if (scrapedMarkdown) {
                  // Update tool part with output-available state
                  toolParts[toolParts.length - 1] = {
                    type: 'tool-scrapeUrl',
                    toolCallId,
                    state: 'output-available',
                    input: toolInput,
                    output: scrapeOutput,
                  };

                  // Write tool-result event to stream for real-time display
                  (dataStream as any).write({
                    type: 'tool-result',
                    toolCallId,
                    toolName: 'scrapeUrl',
                    input: toolInput,
                    output: scrapeOutput,
                  });

                  const scrapeContext = formatScrapedContentForContext({
                    url: scrapeIntent.url,
                    content: scrapedMarkdown,
                  });
                  const scrapeMsg: ChatMessage = {
                    id: generateUUID(),
                    role: 'system',
                    parts: [{ type: 'text', text: scrapeContext } as any],
                    metadata: { createdAt: new Date().toISOString() },
                  };
                  messagesForStream = [...messagesForStream, scrapeMsg];
                }
              } catch (scrapeError) {
                // Update tool part with output-error state
                toolParts[toolParts.length - 1] = {
                  type: 'tool-scrapeUrl',
                  toolCallId,
                  state: 'output-error',
                  input: toolInput,
                  errorText:
                    scrapeError instanceof Error
                      ? scrapeError.message
                      : String(scrapeError),
                };

                // Write tool error to stream for real-time display
                (dataStream as any).write({
                  type: 'tool-result',
                  toolCallId,
                  toolName: 'scrapeUrl',
                  input: toolInput,
                  error:
                    scrapeError instanceof Error
                      ? scrapeError.message
                      : String(scrapeError),
                });

                throw scrapeError;
              }
            }
          } catch (e) {
            console.warn(
              '[chat/route] Preflight search intent or fallback search failed:',
              e,
            );
          }
        }

        const result = streamText({
          model: myProvider.languageModel(effectiveModelId),
          system: systemPrompt({
            selectedChatModel: effectiveModelId,
            requestHints,
          }),
          messages: convertToModelMessages(messagesForStream),
          toolChoice: isSearchFallbackModel ? 'none' : 'auto',
          providerOptions: isSearchFallbackModel
            ? undefined
            : {
                openai: {
                  tool_choice: 'auto',
                },
              },
          stopWhen: stepCountIs(isReasoningModel ? 20 : 5),
          experimental_activeTools: isSearchFallbackModel
            ? []
            : [
                'getWeather',
                'searchWeb',
                'scrapeUrl',
                'createDocument',
                'updateDocument',
                'requestSuggestions',
                'generateImageTool',
              ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: isSearchFallbackModel
            ? undefined
            : {
                getWeather,
                searchWeb,
                scrapeUrl,
                createDocument: createDocument({ session, dataStream }),
                updateDocument: updateDocument({ session, dataStream }),
                requestSuggestions: requestSuggestions({
                  session,
                  dataStream,
                }),
                generateImageTool,
              },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
          onFinish: ({ usage }) => {
            finalUsage = usage;
            dataStream.write({ type: 'data-usage', data: usage });
          },
        });

        result.consumeStream();

        // Merge the main response stream
        // Tool parts will be injected into the assistant message in onFinish
        // This ensures they're persisted and will appear when the message is loaded
        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        // Inject tool parts into the assistant message if we have any
        const messagesWithToolParts = messages.map((message) => {
          if (message.role === 'assistant' && toolParts.length > 0) {
            return {
              ...message,
              parts: [...toolParts, ...(message.parts || [])],
            };
          }
          return message;
        });

        await saveMessages({
          messages: messagesWithToolParts.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });

        if (finalUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalUsage,
            });
          } catch (err) {
            console.warn('Unable to persist last usage for chat', id, err);
          }
        }
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    // Use resumable streams unless there's no context
    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        'AI Gateway requires a valid credit card on file to service requests',
      )
    ) {
      return new ChatSDKError('bad_request:activate_gateway').toResponse();
    }

    console.error('Unhandled error in chat API:', error);
    return new ChatSDKError('offline:chat').toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
