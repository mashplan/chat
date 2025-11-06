/**
 * Preprocesses text content to convert square bracket math expressions
 * to standard LaTeX delimiters that remark-math can process.
 *
 * Converts patterns like [\frac{...}] to $\frac{...}$
 */
export function preprocessMath(text: string): string {
  if (typeof text !== 'string') return text;

  let result = text;

  // Handle square bracket math: [\frac{...}] -> $\frac{...}$
  // We need to match balanced brackets with LaTeX content inside
  // Strategy: find [ followed by content with LaTeX commands, match until ]
  const bracketMathPattern = /\[([^\]]*\\[a-zA-Z@]+[^\]]*)\]/g;

  result = result.replace(bracketMathPattern, (match, content) => {
    // Check if it contains LaTeX commands (backslash followed by letters)
    // This is the key indicator that it's math, not just regular brackets
    if (/\\[a-zA-Z@]+/.test(content)) {
      // Convert to inline math format that remark-math expects
      // Trim whitespace but preserve internal spacing
      const trimmedContent = content.trim();
      return `$${trimmedContent}$`;
    }
    // Not LaTeX, keep original brackets
    return match;
  });

  return result;
}

