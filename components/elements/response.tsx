'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo, useEffect, useMemo, useRef } from 'react';
import { Streamdown } from 'streamdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { preprocessMath } from '@/lib/preprocess-math';

type ResponseProps = ComponentProps<typeof Streamdown>;

let renderMathPromise: Promise<
  typeof import('katex/contrib/auto-render').default
> | null = null;

const getRenderMath = async () => {
  if (!renderMathPromise) {
    renderMathPromise = import('katex/contrib/auto-render')
      .then((mod) => mod.default)
      .catch((error) => {
        renderMathPromise = null;
        throw error;
      });
  }

  return renderMathPromise;
};

export const Response = memo(
  ({
    className,
    remarkPlugins,
    rehypePlugins,
    children,
    ...props
  }: ResponseProps) => {
    // Preprocess children to convert square bracket math to dollar sign math
    const processedChildren = useMemo(() => {
      if (typeof children === 'string') {
        return preprocessMath(children);
      }
      return children;
    }, [children]);

    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      void processedChildren;
      const container = containerRef.current;
      if (!container) return;

      let isCancelled = false;

      void getRenderMath()
        .then((renderMath) => {
          if (isCancelled) return;

          renderMath(container, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\(', right: '\\)', display: false },
            ],
            throwOnError: false,
            trust: true,
          });
        })
        .catch(() => {
          // Swallow errors; math rendering is a progressive enhancement.
        });

      return () => {
        isCancelled = true;
      };
    }, [processedChildren]);

    return (
      <div ref={containerRef} className="size-full">
        <Streamdown
          className={cn(
            'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto',
            className,
          )}
          remarkPlugins={remarkPlugins ?? [remarkMath]}
          rehypePlugins={rehypePlugins ?? [rehypeKatex]}
          {...props}
        >
          {processedChildren}
        </Streamdown>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

Response.displayName = 'Response';
