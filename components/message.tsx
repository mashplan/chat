'use client';
import type { UseChatHelpers } from '@ai-sdk/react';
import equal from 'fast-deep-equal';
import { motion } from 'framer-motion';
import { memo, useState } from 'react';
import type { UIMessagePart } from 'ai';
import type { Vote } from '@/lib/db/schema';
import type { ChatMessage, ChatTools, CustomUIDataTypes } from '@/lib/types';
import { cn, sanitizeText } from '@/lib/utils';
import { useDataStream } from './data-stream-provider';
import { DocumentToolResult } from './document';
import { DocumentPreview } from './document-preview';
import { MessageContent } from './elements/message';
import { Response } from './elements/response';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from './elements/tool';
import { LoaderIcon, SparklesIcon } from './icons';
import { MessageActions } from './message-actions';
import { MessageEditor } from './message-editor';
import { MessageReasoning } from './message-reasoning';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
import { CodeBlock } from './elements/code-block';
import { useTranslations } from 'next-intl';

type MessagePart = UIMessagePart<CustomUIDataTypes, ChatTools>;

type SearchWebOutput = {
  query?: string;
  resultCount?: number;
  results?: Array<{
    title?: string;
    url: string;
    description?: string;
  }>;
  summary?: string | null;
  privacy_notice?: string;
};

type ScrapeUrlOutput = {
  url: string;
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: {
      title: string;
      description?: string;
      language?: string | null;
      sourceURL: string;
      statusCode?: number | null;
      ogTitle?: string;
      ogDescription?: string;
      ogImage?: string;
    };
  };
  message?: string;
};

type SearchWebPart = MessagePart & {
  type: 'tool-searchWeb';
  output?: SearchWebOutput;
};

type ScrapeUrlPart = MessagePart & {
  type: 'tool-scrapeUrl';
  output?: ScrapeUrlOutput;
};

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding,
  isArtifactVisible,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  isArtifactVisible: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === 'file',
  );

  useDataStream();

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full"
      data-role={message.role}
      data-testid={`message-${message.role}`}
      initial={{ opacity: 0 }}
    >
      <div
        className={cn('flex w-full items-start gap-2 md:gap-3', {
          'justify-end': message.role === 'user' && mode !== 'edit',
          'justify-start': message.role === 'assistant',
        })}
      >
        {message.role === 'assistant' && (
          <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
            {isLoading ? (
              <span className="inline-flex animate-spin">
                <LoaderIcon size={14} />
              </span>
            ) : (
              <SparklesIcon size={14} />
            )}
          </div>
        )}

        <div
          className={cn('flex flex-col', {
            'gap-2 md:gap-4': message.parts?.some(
              (p) => p.type === 'text' && p.text?.trim(),
            ),
            'min-h-96': message.role === 'assistant' && requiresScrollPadding,
            'w-full':
              (message.role === 'assistant' &&
                message.parts?.some(
                  (p) => p.type === 'text' && p.text?.trim(),
                )) ||
              mode === 'edit',
            'max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]':
              message.role === 'user' && mode !== 'edit',
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              className="flex flex-row justify-end gap-2"
              data-testid={'message-attachments'}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={{
                    name: attachment.filename ?? 'file',
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  key={attachment.url}
                />
              ))}
            </div>
          )}

          {message.role === 'assistant' &&
            isLoading &&
            (message.parts?.length ?? 0) === 0 && (
              <MessageContent className="-ml-4 bg-transparent">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="inline-flex animate-spin">
                    <LoaderIcon size={14} />
                  </span>
                  Preparing response...
                </div>
              </MessageContent>
            )}

          {(() => {
            // Find the last text part and collect reasoning parts that come after it
            let lastTextIndex = -1;
            message.parts?.forEach((part, index) => {
              if (part.type === 'text') {
                lastTextIndex = index;
              }
            });

            const reasoningAfterText: typeof message.parts = [];
            const renderedReasoningIndices = new Set<number>();

            if (lastTextIndex >= 0) {
              message.parts?.forEach((part, index) => {
                if (
                  index > lastTextIndex &&
                  part.type === 'reasoning' &&
                  part.text?.trim().length > 0
                ) {
                  reasoningAfterText.push(part);
                  renderedReasoningIndices.add(index);
                }
              });
            }

            // Render parts in order, but insert reasoning-after-text before the last text part
            return (
              <>
                {message.parts?.map((part, index) => {
                  // Skip reasoning parts that will be inserted before text
                  if (renderedReasoningIndices.has(index)) {
                    return null;
                  }

                  const { type } = part;
                  const key = `message-${message.id}-part-${index}`;

                  // Insert reasoning-after-text before the last text part
                  if (
                    type === 'text' &&
                    index === lastTextIndex &&
                    reasoningAfterText.length > 0
                  ) {
                    return (
                      <>
                        {reasoningAfterText.map((reasoningPart) => {
                          if (
                            reasoningPart.type === 'reasoning' &&
                            reasoningPart.text
                          ) {
                            return (
                              <MessageReasoning
                                isLoading={isLoading}
                                key={`${key}-reasoning-${reasoningPart.text.substring(0, 20)}`}
                                reasoning={reasoningPart.text}
                              />
                            );
                          }
                          return null;
                        })}
                        {(() => {
                          if (mode === 'view') {
                            return (
                              <div key={key}>
                                <MessageContent
                                  className={cn({
                                    'w-fit break-words rounded-2xl px-3 py-2 text-right text-white':
                                      message.role === 'user',
                                    'bg-transparent px-0 py-0 text-left':
                                      message.role === 'assistant',
                                  })}
                                  data-testid="message-content"
                                  style={
                                    message.role === 'user'
                                      ? { backgroundColor: '#006cff' }
                                      : undefined
                                  }
                                >
                                  <Response>{sanitizeText(part.text)}</Response>
                                </MessageContent>
                              </div>
                            );
                          }

                          if (mode === 'edit') {
                            return (
                              <div
                                className="flex w-full flex-row items-start gap-3"
                                key={key}
                              >
                                <div className="size-8" />
                                <div className="min-w-0 flex-1">
                                  <MessageEditor
                                    key={message.id}
                                    message={message}
                                    regenerate={regenerate}
                                    setMessages={setMessages}
                                    setMode={setMode}
                                  />
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </>
                    );
                  }

                  if (type === 'reasoning' && part.text?.trim().length > 0) {
                    return (
                      <MessageReasoning
                        isLoading={isLoading}
                        key={key}
                        reasoning={part.text}
                      />
                    );
                  }

                  if (type === 'text' && part.text?.trim().length > 0) {
                    if (mode === 'view') {
                      return (
                        <div key={key}>
                          <MessageContent
                            className={cn({
                              'w-fit break-words rounded-2xl px-3 py-2 text-right text-white':
                                message.role === 'user',
                              'bg-transparent px-0 py-0 text-left':
                                message.role === 'assistant',
                            })}
                            data-testid="message-content"
                            style={
                              message.role === 'user'
                                ? { backgroundColor: '#006cff' }
                                : undefined
                            }
                          >
                            <Response>{sanitizeText(part.text)}</Response>
                          </MessageContent>
                        </div>
                      );
                    }

                    if (mode === 'edit') {
                      return (
                        <div
                          className="flex w-full flex-row items-start gap-3"
                          key={key}
                        >
                          <div className="size-8" />
                          <div className="min-w-0 flex-1">
                            <MessageEditor
                              key={message.id}
                              message={message}
                              regenerate={regenerate}
                              setMessages={setMessages}
                              setMode={setMode}
                            />
                          </div>
                        </div>
                      );
                    }
                  }

                  if (type === 'tool-getWeather') {
                    const { toolCallId, state } = part;

                    return (
                      <Tool defaultOpen={true} key={toolCallId}>
                        <ToolHeader state={state} type="tool-getWeather" />
                        <ToolContent>
                          {state === 'input-available' && (
                            <ToolInput input={part.input} />
                          )}
                          {state === 'output-available' && (
                            <ToolOutput
                              errorText={undefined}
                              output={
                                <Weather weatherAtLocation={part.output} />
                              }
                            />
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  }

                  if (type === 'tool-createDocument') {
                    const { toolCallId } = part;

                    if (part.output && 'error' in part.output) {
                      return (
                        <div
                          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                          key={toolCallId}
                        >
                          Error creating document: {String(part.output.error)}
                        </div>
                      );
                    }

                    return (
                      <DocumentPreview
                        isReadonly={isReadonly}
                        key={toolCallId}
                        result={part.output}
                      />
                    );
                  }

                  if (type === 'tool-updateDocument') {
                    const { toolCallId } = part;

                    if (part.output && 'error' in part.output) {
                      return (
                        <div
                          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                          key={toolCallId}
                        >
                          Error updating document: {String(part.output.error)}
                        </div>
                      );
                    }

                    return (
                      <div className="relative" key={toolCallId}>
                        <DocumentPreview
                          args={{ ...part.output, isUpdate: true }}
                          isReadonly={isReadonly}
                          result={part.output}
                        />
                      </div>
                    );
                  }

                  if (type === 'tool-requestSuggestions') {
                    const { toolCallId, state } = part;

                    return (
                      <Tool defaultOpen={true} key={toolCallId}>
                        <ToolHeader
                          state={state}
                          type="tool-requestSuggestions"
                        />
                        <ToolContent>
                          {state === 'input-available' && (
                            <ToolInput input={part.input} />
                          )}
                          {state === 'output-available' && (
                            <ToolOutput
                              errorText={undefined}
                              output={
                                'error' in part.output ? (
                                  <div className="rounded border p-2 text-red-500">
                                    Error: {String(part.output.error)}
                                  </div>
                                ) : (
                                  <DocumentToolResult
                                    isReadonly={isReadonly}
                                    result={part.output}
                                    type="request-suggestions"
                                  />
                                )
                              }
                            />
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  }

                  if (type === 'tool-searchWeb') {
                    const searchPart = part as SearchWebPart;
                    const { toolCallId, state } = searchPart;
                    const output = searchPart.output as
                      | SearchWebOutput
                      | undefined;
                    const t = useTranslations('Tool');
                    return (
                      <Tool key={toolCallId} defaultOpen={true}>
                        <ToolHeader state={state} type="tool-searchWeb" />
                        <ToolContent>
                          {state === 'input-available' && (
                            <ToolInput input={searchPart.input} />
                          )}
                          {state === 'output-error' && (
                            <ToolOutput
                              output={
                                <div className="space-y-2">
                                  <div className="text-muted-foreground text-xs">
                                    Raw error
                                  </div>
                                  <div className="rounded-md bg-muted/50 p-2 text-xs">
                                    <CodeBlock
                                      code={String(searchPart.errorText || '')}
                                      language="text"
                                    />
                                  </div>
                                </div>
                              }
                              errorText={searchPart.errorText}
                            />
                          )}
                          {state === 'output-available' && (
                            <ToolOutput
                              output={
                                <div className="min-w-0 space-y-3 p-2">
                                  {output?.summary && (
                                    <div className="min-w-0 rounded-md bg-muted/50 p-2 text-xs">
                                      <div className="font-medium">
                                        {t('searchWeb.summary')}
                                      </div>
                                      <div className="break-words">
                                        {output.summary}
                                      </div>
                                    </div>
                                  )}
                                  <div className="min-w-0 break-words text-muted-foreground text-xs">
                                    {t('searchWeb.query')}:{' '}
                                    <span className="break-all font-medium">
                                      {output?.query ?? searchPart.input?.query}
                                    </span>
                                    {typeof output?.resultCount ===
                                      'number' && (
                                      <span>
                                        {' '}
                                        • {t('result')}: {output.resultCount}
                                      </span>
                                    )}
                                  </div>
                                  {Array.isArray(output?.results) &&
                                    output.results.length > 0 && (
                                      <div className="space-y-2">
                                        {output.results.map((r, i) => (
                                          <div
                                            key={r.url ?? i}
                                            className="min-w-0 rounded-md border bg-background p-2"
                                          >
                                            <div className="min-w-0 break-words font-medium text-xs">
                                              <a
                                                href={r.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="break-all underline"
                                              >
                                                {r.title || r.url}
                                              </a>
                                            </div>
                                            {r.description && (
                                              <div className="mt-1 line-clamp-3 break-words text-muted-foreground text-xs">
                                                {r.description}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  {output?.privacy_notice && (
                                    <div className="text-[10px] text-muted-foreground">
                                      {output.privacy_notice}
                                    </div>
                                  )}
                                </div>
                              }
                              errorText={searchPart.errorText}
                            />
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  }

                  if (type === 'tool-scrapeUrl') {
                    const scrapePart = part as ScrapeUrlPart;
                    const { toolCallId, state } = scrapePart;
                    const output = scrapePart.output as
                      | ScrapeUrlOutput
                      | undefined;
                    const t = useTranslations('Tool');
                    return (
                      <Tool key={toolCallId} defaultOpen={true}>
                        <ToolHeader state={state} type="tool-scrapeUrl" />
                        <ToolContent>
                          {state === 'input-available' && (
                            <ToolInput input={scrapePart.input} />
                          )}
                          {state === 'output-error' && (
                            <ToolOutput
                              output={
                                <div className="space-y-2">
                                  <div className="text-muted-foreground text-xs">
                                    Raw error
                                  </div>
                                  <div className="rounded-md bg-muted/50 p-2 text-xs">
                                    <CodeBlock
                                      code={String(scrapePart.errorText || '')}
                                      language="text"
                                    />
                                  </div>
                                </div>
                              }
                              errorText={scrapePart.errorText}
                            />
                          )}
                          {state === 'output-available' && (
                            <ToolOutput
                              output={
                                <div className="min-w-0 space-y-3">
                                  <div className="min-w-0 break-words text-muted-foreground text-xs">
                                    {t('scrapeUrl.scraped')}:{' '}
                                    <span className="break-all font-medium">
                                      {output?.url || scrapePart.input?.url}
                                    </span>
                                  </div>
                                  {output?.data?.metadata && (
                                    <div className="min-w-0 rounded-md border bg-background p-2 text-xs">
                                      <div className="font-medium">
                                        {t('scrapeUrl.metadata')}
                                      </div>
                                      <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                                        <div className="min-w-0 break-words">
                                          {t('scrapeUrl.outputTitle')}:{' '}
                                          {output.data.metadata.title}
                                        </div>
                                        <div className="min-w-0 break-words">
                                          {t('scrapeUrl.language')}:{' '}
                                          {output.data.metadata.language ||
                                            'n/a'}
                                        </div>
                                        <div className="min-w-0 break-words">
                                          {t('scrapeUrl.statusCode')}:{' '}
                                          {String(
                                            output.data.metadata.statusCode ??
                                              'n/a',
                                          )}
                                        </div>
                                        <div className="min-w-0 break-words">
                                          {t('scrapeUrl.sourceURL')}:{' '}
                                          <span className="break-all">
                                            {output.data.metadata.sourceURL}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {output?.data?.markdown && (
                                    <div className="min-w-0 max-w-full rounded-md bg-muted/50 p-2 text-xs">
                                      <div className="font-medium">
                                        {t('scrapeUrl.markdown')}
                                      </div>
                                      <div className="mt-1 line-clamp-6 max-w-full whitespace-pre-wrap break-all [&_a]:break-all [&_a]:underline">
                                        {output.data.markdown.slice(0, 2000)}
                                      </div>
                                    </div>
                                  )}
                                  <details className="min-w-0 max-w-full overflow-hidden rounded-md border p-2 text-xs">
                                    <summary className="cursor-pointer select-none font-medium">
                                      Raw JSON
                                    </summary>
                                    <div className="mt-2 min-w-0 max-w-full overflow-hidden">
                                      <CodeBlock
                                        code={JSON.stringify(output, null, 2)}
                                        language="json"
                                      />
                                    </div>
                                  </details>
                                </div>
                              }
                              errorText={scrapePart.errorText}
                            />
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  }

                  return null;
                })}
              </>
            );
          })()}

          {!isReadonly && (
            <MessageActions
              chatId={chatId}
              isLoading={isLoading}
              key={`action-${message.id}`}
              message={message}
              setMode={setMode}
              vote={vote}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.message.id !== nextProps.message.id) {
      return false;
    }
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding) {
      return false;
    }
    if (!equal(prevProps.message.parts, nextProps.message.parts)) {
      return false;
    }
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }

    return false;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full"
      data-role={role}
      data-testid="message-assistant-loading"
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start justify-start gap-3">
        <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <span className="inline-flex animate-spin">
            <LoaderIcon size={14} />
          </span>
        </div>

        <div className="flex w-full flex-col gap-2 md:gap-4">
          <div className="p-0 text-muted-foreground text-sm">
            <LoadingText>Thinking...</LoadingText>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const LoadingText = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      animate={{ backgroundPosition: ['100% 50%', '-100% 50%'] }}
      transition={{
        duration: 1.5,
        repeat: Number.POSITIVE_INFINITY,
        ease: 'linear',
      }}
      style={{
        background:
          'linear-gradient(90deg, hsl(var(--muted-foreground)) 0%, hsl(var(--muted-foreground)) 35%, hsl(var(--foreground)) 50%, hsl(var(--muted-foreground)) 65%, hsl(var(--muted-foreground)) 100%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
      }}
      className="flex items-center text-transparent"
    >
      {children}
    </motion.div>
  );
};
