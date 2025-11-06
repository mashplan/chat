declare module 'katex/contrib/auto-render' {
  export type RenderMathDelimiter = {
    left: string;
    right: string;
    display: boolean;
  };

  export type RenderMathOptions = {
    delimiters?: Array<RenderMathDelimiter>;
    ignoredTags?: string[];
    ignoredClasses?: string[];
    trust?: boolean;
    throwOnError?: boolean;
    errorColor?: string;
    macros?: Record<string, string>;
  };

  export type RenderMathInElement = (
    element: HTMLElement,
    options?: RenderMathOptions,
  ) => void;

  const renderMathInElement: RenderMathInElement;
  export default renderMathInElement;
}

