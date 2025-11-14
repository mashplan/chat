'use client';
import { motion } from 'framer-motion';
import { memo, useState } from 'react';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolResult } from './document';
import { LoaderIcon, SparklesIcon } from './icons';
import { Response } from './elements/response';
import { MessageContent } from './elements/message';
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from './elements/tool';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
import equal from 'fast-deep-equal';
import { cn, sanitizeText } from '@/lib/utils';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { MessageReasoning } from './message-reasoning';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';
import { useDataStream } from './data-stream-provider';
import { CodeBlock } from './elements/code-block';

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
      data-testid={`message-${message.role}`}
      className="group/message w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-role={message.role}
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
              data-testid={`message-attachments`}
              className="flex flex-row justify-end gap-2"
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  key={attachment.url}
                  attachment={{
                    name: attachment.filename ?? 'file',
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
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
            // Find the first non-reasoning part
            const firstNonReasoningIndex =
              message.parts?.findIndex(
                (part) =>
                  part.type !== 'reasoning' ||
                  !part.text?.trim() ||
                  part.text.trim().length === 0,
              ) ?? -1;

            // Collect reasoning parts that come before the first non-reasoning part
            const leadingReasoningParts: typeof message.parts = [];
            const renderedReasoningIndices = new Set<number>();

            if (firstNonReasoningIndex > 0) {
              message.parts?.forEach((part, index) => {
                if (
                  index < firstNonReasoningIndex &&
                  part.type === 'reasoning' &&
                  part.text?.trim().length > 0
                ) {
                  leadingReasoningParts.push(part);
                  renderedReasoningIndices.add(index);
                }
              });
            }

            // Render leading reasoning parts first, then all parts in order
            // (skipping reasoning parts already rendered at the top)
            return (
              <>
                {leadingReasoningParts.map((part, index) => {
                  const key = `message-${message.id}-reasoning-${index}`;
                  return (
                    <MessageReasoning
                      key={key}
                      isLoading={isLoading}
                      reasoning={part.text}
                    />
                  );
                })}
                {message.parts?.map((part, index) => {
                  // Skip reasoning parts that were already rendered at the top
                  if (renderedReasoningIndices.has(index)) {
                    return null;
                  }

                  const { type } = part;
                  const key = `message-${message.id}-part-${index}`;

                  if (type === 'reasoning' && part.text?.trim().length > 0) {
                    return (
                      <MessageReasoning
                        key={key}
                        isLoading={isLoading}
                        reasoning={part.text}
                      />
                    );
                  }

                  if (type === 'text') {
                    if (mode === 'view') {
                      return (
                        <div key={key}>
                          <MessageContent
                            data-testid="message-content"
                            className={cn({
                              'w-fit break-words rounded-2xl px-3 py-2 text-right text-white':
                                message.role === 'user',
                              'bg-transparent px-0 py-0 text-left':
                                message.role === 'assistant',
                            })}
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
                          key={key}
                          className="flex w-full flex-row items-start gap-3"
                        >
                          <div className="size-8" />
                          <div className="min-w-0 flex-1">
                            <MessageEditor
                              key={message.id}
                              message={message}
                              setMode={setMode}
                              setMessages={setMessages}
                              regenerate={regenerate}
                            />
                          </div>
                        </div>
                      );
                    }
                  }

                  if (type === 'tool-getWeather') {
                    const { toolCallId, state } = part;

                    return (
                      <Tool key={toolCallId} defaultOpen={true}>
                        <ToolHeader type="tool-getWeather" state={state} />
                        <ToolContent>
                          {state === 'input-available' && (
                            <ToolInput input={part.input} />
                          )}
                          {state === 'output-available' && (
                            <ToolOutput
                              output={
                                <Weather weatherAtLocation={part.output} />
                              }
                              errorText={undefined}
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
                          key={toolCallId}
                          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                        >
                          Error creating document: {String(part.output.error)}
                        </div>
                      );
                    }

                    return (
                      <DocumentPreview
                        key={toolCallId}
                        isReadonly={isReadonly}
                        result={part.output}
                      />
                    );
                  }

                  if (type === 'tool-updateDocument') {
                    const { toolCallId } = part;

                    if (part.output && 'error' in part.output) {
                      return (
                        <div
                          key={toolCallId}
                          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                        >
                          Error updating document: {String(part.output.error)}
                        </div>
                      );
                    }

                    return (
                      <div key={toolCallId} className="relative">
                        <DocumentPreview
                          isReadonly={isReadonly}
                          result={part.output}
                          args={{ ...part.output, isUpdate: true }}
                        />
                      </div>
                    );
                  }

                  if (type === 'tool-requestSuggestions') {
                    const { toolCallId, state } = part;

                    return (
                      <Tool key={toolCallId} defaultOpen={true}>
                        <ToolHeader
                          type="tool-requestSuggestions"
                          state={state}
                        />
                        <ToolContent>
                          {state === 'input-available' && (
                            <ToolInput input={part.input} />
                          )}
                          {state === 'output-available' && (
                            <ToolOutput
                              output={
                                'error' in part.output ? (
                                  <div className="rounded border p-2 text-red-500">
                                    Error: {String(part.output.error)}
                                  </div>
                                ) : (
                                  <DocumentToolResult
                                    type="request-suggestions"
                                    result={part.output}
                                    isReadonly={isReadonly}
                                  />
                                )
                              }
                              errorText={undefined}
                            />
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  }

                  if ((part as any).type === 'tool-searchWeb') {
                    const { toolCallId, state } = part as any;

                    return (
                      <Tool key={toolCallId} defaultOpen={true}>
                        <ToolHeader state={state} type="tool-searchWeb" />
                        <ToolContent>
                          {state === 'input-available' && (
                            <ToolInput input={(part as any).input} />
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
                                      code={String(
                                        (part as any).errorText || '',
                                      )}
                                      language="text"
                                    />
                                  </div>
                                </div>
                              }
                              errorText={(part as any).errorText}
                            />
                          )}
                          {state === 'output-available' && (
                            <ToolOutput
                              output={
                                <div className="space-y-3">
                                  {(part as any).output?.summary && (
                                    <div className="rounded-md bg-muted/50 p-2 text-xs">
                                      <div className="font-medium">Summary</div>
                                      <div>{(part as any).output.summary}</div>
                                    </div>
                                  )}
                                  <div className="text-muted-foreground text-xs">
                                    Query:{' '}
                                    <span className="font-medium">
                                      {(part as any).output?.query ??
                                        (part as any).input?.query}
                                    </span>
                                    {typeof (part as any).output
                                      ?.resultCount === 'number' && (
                                      <span>
                                        {' '}
                                        • Results:{' '}
                                        {(part as any).output.resultCount}
                                      </span>
                                    )}
                                  </div>
                                  {Array.isArray(
                                    (part as any).output?.results,
                                  ) &&
                                    (part as any).output.results.length > 0 && (
                                      <div className="space-y-2">
                                        {(part as any).output.results.map(
                                          (r: any, i: number) => (
                                            <div
                                              key={r.url ?? i}
                                              className="rounded-md border bg-background p-2"
                                            >
                                              <div className="truncate font-medium text-xs">
                                                <a
                                                  href={r.url}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="underline"
                                                >
                                                  {r.title || r.url}
                                                </a>
                                              </div>
                                              {r.description && (
                                                <div className="mt-1 line-clamp-3 text-muted-foreground text-xs">
                                                  {r.description}
                                                </div>
                                              )}
                                            </div>
                                          ),
                                        )}
                                      </div>
                                    )}
                                  {(part as any).output?.privacy_notice && (
                                    <div className="text-[10px] text-muted-foreground">
                                      {(part as any).output.privacy_notice}
                                    </div>
                                  )}
                                </div>
                              }
                              errorText={(part as any).errorText}
                            />
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  }

                  if ((part as any).type === 'tool-scrapeUrl') {
                    const { toolCallId, state } = part as any;

                    return (
                      <Tool key={toolCallId} defaultOpen={true}>
                        <ToolHeader state={state} type="tool-scrapeUrl" />
                        <ToolContent>
                          {state === 'input-available' && (
                            <ToolInput input={(part as any).input} />
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
                                      code={String(
                                        (part as any).errorText || '',
                                      )}
                                      language="text"
                                    />
                                  </div>
                                </div>
                              }
                              errorText={(part as any).errorText}
                            />
                          )}
                          {state === 'output-available' && (
                            <ToolOutput
                              output={
                                <div className="space-y-3">
                                  <div className="text-muted-foreground text-xs">
                                    Scraped:{' '}
                                    <span className="font-medium">
                                      {(part as any).output?.url ||
                                        (part as any).input?.url}
                                    </span>
                                  </div>
                                  {(part as any).output?.data?.metadata && (
                                    <div className="rounded-md border bg-background p-2 text-xs">
                                      <div className="font-medium">
                                        Metadata
                                      </div>
                                      <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                                        <div>
                                          Title:{' '}
                                          {
                                            (part as any).output.data.metadata
                                              .title
                                          }
                                        </div>
                                        <div>
                                          Language:{' '}
                                          {(part as any).output.data.metadata
                                            .language || 'n/a'}
                                        </div>
                                        <div>
                                          Status:{' '}
                                          {String(
                                            (part as any).output.data.metadata
                                              .statusCode ?? 'n/a',
                                          )}
                                        </div>
                                        <div>
                                          Source:{' '}
                                          {
                                            (part as any).output.data.metadata
                                              .sourceURL
                                          }
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {(part as any).output?.data?.markdown && (
                                    <div className="rounded-md bg-muted/50 p-2 text-xs">
                                      <div className="font-medium">
                                        Markdown (preview)
                                      </div>
                                      <div className="mt-1 line-clamp-6 whitespace-pre-wrap">
                                        {(
                                          part as any
                                        ).output.data.markdown.slice(0, 2000)}
                                      </div>
                                    </div>
                                  )}
                                  <details className="rounded-md border p-2 text-xs">
                                    <summary className="cursor-pointer select-none font-medium">
                                      Raw JSON
                                    </summary>
                                    <div className="mt-2">
                                      <CodeBlock
                                        code={JSON.stringify(
                                          (part as any).output,
                                          null,
                                          2,
                                        )}
                                        language="json"
                                      />
                                    </div>
                                  </details>
                                </div>
                              }
                              errorText={(part as any).errorText}
                            />
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  }
                })}
              </>
            );
          })()}

          {!isReadonly && (
            <MessageActions
              key={`action-${message.id}`}
              chatId={chatId}
              message={message}
              vote={vote}
              isLoading={isLoading}
              setMode={setMode}
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
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return false;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="group/message w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-role={role}
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
