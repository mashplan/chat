import type { LanguageModelV2Middleware } from '@ai-sdk/provider';

/**
 * Middleware to extract reasoning from OpenAI Harmony format.
 * The Harmony format uses channels to separate reasoning (analysis) from final responses.
 * Format: <|channel|>analysis<|message|>{reasoning}<|end|><|start|>assistant<|channel|>final<|message|>{response}
 */
export function extractHarmonyReasoningMiddleware(): LanguageModelV2Middleware {
  return {
    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate();

      // Function to extract content from Harmony format
      const extractHarmonyContent = (text: string) => {
        console.log('[Harmony Middleware] Raw text:', text);

        // Pattern to match Harmony format messages
        const messagePattern =
          /<\|channel\|>(\w+)<\|message\|>([\s\S]*?)(?=<\|end\|>|<\|channel\|>|$)/g;

        let reasoning = '';
        let finalContent = '';
        let lastContent = '';

        // Extract all messages with their channels
        let match: RegExpExecArray | null;
        match = messagePattern.exec(text);
        while (match !== null) {
          const channel = match[1];
          const content = match[2];

          console.log(
            `[Harmony Middleware] Found channel: ${channel}, content: ${content.substring(0, 50)}...`,
          );

          if (channel === 'analysis') {
            // Accumulate reasoning from analysis channel
            reasoning += (reasoning ? '\n\n' : '') + content.trim();
          } else if (channel === 'final') {
            // Accumulate final content
            finalContent += (finalContent ? '\n\n' : '') + content.trim();
          } else if (channel === 'commentary') {
            // Commentary is typically for tool calls, include in final
            finalContent += (finalContent ? '\n\n' : '') + content.trim();
          }

          lastContent = content.trim();
          match = messagePattern.exec(text);
        }

        // If no channels found, try to parse token-only variant like
        // "analysis...assistantfinal ..." or "analysis...final ..."
        if (!reasoning && !finalContent) {
          const analysisIdx = text.indexOf('analysis');
          // Prefer the longer token first
          let finalIdx = text.indexOf('assistantfinal');
          if (finalIdx === -1) {
            // Fallback to a standalone "final" at a boundary
            const finalMatch = text.match(
              /(?:^|\n|\r)(assistantfinal|final)\b/,
            );
            if (finalMatch && typeof finalMatch.index === 'number') {
              finalIdx = finalMatch.index;
            }
          }

          if (analysisIdx === 0 && finalIdx > analysisIdx) {
            const reasoningSegment = text
              .substring(analysisIdx + 'analysis'.length, finalIdx)
              .trim();
            const finalSegment = text
              .substring(finalIdx)
              .replace(/^(assistantfinal|final)\b\s*/i, '')
              .trim();

            if (reasoningSegment) reasoning = reasoningSegment;
            if (finalSegment) finalContent = finalSegment;
          }
        }

        // If still no channels found, check if entire text might be the response
        if (!reasoning && !finalContent) {
          console.log(
            '[Harmony Middleware] No channels found, checking for Harmony markers',
          );
          // Check if text contains Harmony markers
          if (text.includes('<|channel|>') || text.includes('<|message|>')) {
            // Harmony format detected but couldn't parse - use last content
            finalContent = lastContent || text;
            console.log(
              '[Harmony Middleware] Harmony format detected but parsing failed',
            );
          } else {
            // Not Harmony format, use entire text
            finalContent = text;
            console.log(
              '[Harmony Middleware] Not Harmony format, using entire text',
            );
          }
        }

        console.log(
          `[Harmony Middleware] Extracted - Reasoning: ${reasoning.substring(0, 50)}..., Final: ${finalContent.substring(0, 50)}...`,
        );
        return { reasoning, finalContent };
      };

      // Gather original text content to a single string
      const originalTextParts = result.content.filter(
        (p: any) => p?.type === 'text',
      ) as Array<{ type: 'text'; text: string }>;
      const originalOtherParts = result.content.filter(
        (p: any) => p?.type !== 'text',
      ) as any[];

      const originalText = originalTextParts.map((p) => p.text).join('');

      if (!originalText) {
        console.log('[Harmony Middleware] No text in result, returning as is');
        return result;
      }

      const { reasoning, finalContent } = extractHarmonyContent(originalText);

      const newContent: any[] = [...originalOtherParts];
      if (reasoning) {
        newContent.push({ type: 'reasoning', text: reasoning });
      }
      newContent.push({ type: 'text', text: finalContent || originalText });

      return { ...result, content: newContent };
    },

    wrapStream: async ({ doStream }) => {
      console.log('[Harmony Middleware] wrapStream called');
      const { stream, request, response } = await doStream();

      let buffer = '';
      let currentChannel: '' | 'analysis' | 'final' = '';
      let splitOccurred = false; // for token-only variant
      let reasoningStarted = false;
      let lastTextId: string | undefined;
      let reasoningId: string | undefined;

      const transformed = new ReadableStream<any>({
        start: async (controller) => {
          const reader = stream.getReader();
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;

            const part = value as any;

            if (part?.type === 'text-start') {
              lastTextId = part.id;
              controller.enqueue(part);
              continue;
            }

            if (part?.type === 'text-delta') {
              const deltaText: string = (part.delta ?? '') as string;
              buffer += deltaText;

              // detect harmony markers
              const markerMatch = buffer.match(
                /<\|channel\|>(\w+)<\|message\|>/,
              );
              if (markerMatch) {
                currentChannel =
                  markerMatch[1] === 'analysis' ? 'analysis' : 'final';
                buffer = buffer.replace(markerMatch[0], '');
              }

              if (!markerMatch) {
                const finalIdx = buffer.indexOf('assistantfinal');
                const altFinalMatch =
                  finalIdx === -1 ? buffer.match(/(?:^|\n)(final)\b/) : null;
                if (!splitOccurred && (finalIdx !== -1 || altFinalMatch)) {
                  const idx =
                    finalIdx !== -1 ? finalIdx : (altFinalMatch?.index ?? -1);
                  const before = buffer
                    .substring(0, idx)
                    .replace(/^analysis\b\s*/i, '');
                  const after = buffer
                    .substring(idx)
                    .replace(/^(assistantfinal|final)\b\s*/i, '');
                  if (before) {
                    if (!reasoningStarted) {
                      reasoningId = `${lastTextId ?? 't'}-r`;
                      controller.enqueue({
                        type: 'reasoning-start',
                        id: reasoningId,
                      });
                      reasoningStarted = true;
                    }
                    controller.enqueue({
                      type: 'reasoning-delta',
                      id: reasoningId ?? 'r',
                      delta: before,
                    });
                  }
                  buffer = after;
                  currentChannel = 'final';
                  splitOccurred = true;
                }
              }

              // If we still don't know the channel, and buffer starts with 'analysis'
              if (!currentChannel && /^analysis/i.test(buffer)) {
                currentChannel = 'analysis';
                buffer = buffer.replace(/^analysis/i, '');
              }

              // If channel is still unknown, keep buffering until we can classify
              if (!currentChannel) {
                continue;
              }

              if (currentChannel === 'analysis') {
                if (buffer) {
                  if (!reasoningStarted) {
                    reasoningId = `${lastTextId ?? 't'}-r`;
                    controller.enqueue({
                      type: 'reasoning-start',
                      id: reasoningId,
                    });
                    reasoningStarted = true;
                  }
                  controller.enqueue({
                    type: 'reasoning-delta',
                    id: reasoningId ?? 'r',
                    delta: buffer,
                  });
                  buffer = '';
                }
              } else {
                if (buffer) {
                  controller.enqueue({
                    type: 'text-delta',
                    id: lastTextId ?? 't',
                    delta: buffer,
                  });
                  buffer = '';
                }
              }
              continue;
            }

            // pass-through other parts
            controller.enqueue(part);
          }

          // flush remaining buffer
          if (buffer) {
            if (currentChannel === 'analysis') {
              if (!reasoningStarted) {
                reasoningId = `${lastTextId ?? 't'}-r`;
                controller.enqueue({
                  type: 'reasoning-start',
                  id: reasoningId,
                });
                reasoningStarted = true;
              }
              controller.enqueue({
                type: 'reasoning-delta',
                id: reasoningId ?? 'r',
                delta: buffer,
              });
            } else {
              controller.enqueue({
                type: 'text-delta',
                id: lastTextId ?? 't',
                delta: buffer,
              });
            }
          }

          controller.close();
        },
      });

      return { stream: transformed, request, response };
    },

    transformParams: async ({ type, params, model }) => {
      // No transformation needed for params
      return params;
    },
  };
}
