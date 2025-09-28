import { tool } from 'ai';
import { z } from 'zod';
import FirecrawlApp from '@mendable/firecrawl-js';

// Anonymize queries to protect user privacy
function anonymizeQuery(query: string): string {
  // Remove potential personal identifiers
  return query
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, 'EMAIL') // Remove emails
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'IP_ADDRESS'); // Remove IPs
}

// Compact large markdown blobs to reduce token usage while preserving meaning
function compactMarkdown(
  markdown: string,
  maxChars: number,
): {
  content: string;
  originalLength: number;
  truncated: boolean;
} {
  const originalLength = markdown?.length ?? 0;
  if (!markdown) {
    return { content: '', originalLength, truncated: false };
  }

  let text = markdown;

  // Remove markdown images: ![alt](url)
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  // Remove HTML <img ...> tags
  text = text.replace(/<img[^>]*>/gi, '');
  // Replace inline links [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // Replace reference-style links [text][id] -> text
  text = text.replace(/\[([^\]]+)\]\[[^\]]+\]/g, '$1');
  // Drop link definitions: [id]: url
  text = text.replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gim, '');
  // Remove footnote markers like [1], [12]
  text = text.replace(/\[(\d{1,3})\]/g, '');
  // Keep tables intact for structured facts like infoboxes
  // Normalize whitespace
  text = text.replace(/\s+$/gm, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[\t\v\f]+/g, ' ');
  text = text.replace(/ {2,}/g, ' ');

  // Truncate to limit
  const truncated = text.length > maxChars;
  if (truncated) {
    text = text.slice(0, maxChars);
  }

  return { content: text, originalLength, truncated };
}

export const searchWeb = tool({
  description:
    'Search the web for information. Use this when you need current information, facts, or data not in your training.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    maxResults: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .default(5)
      .describe('Maximum number of results to return'),
    tbs: z
      .string()
      .optional()
      .describe(
        'Time Based Search filter. qdr:h=past hour, qdr:d=past day, qdr:w=past week, qdr:m=past month, qdr:y=past year. Custom range: cdr:1,cd_min:MM/DD/YYYY,cd_max:MM/DD/YYYY.',
      ),
    sources: z
      .array(z.enum(['web', 'news', 'images']))
      .optional()
      .describe('Search sources to query. Defaults to ["web"].'),
    categories: z
      .array(z.enum(['github', 'research']))
      .optional()
      .describe(
        'Optional categories. Filter search results by specific categories using the categories parameter (e.g., github, research).',
      ),
    location: z
      .string()
      .optional()
      .describe(
        'Optional geographic location to target results (e.g., "United States").',
      ),
  }),
  execute: async ({
    query,
    maxResults,
    tbs,
    sources,
    categories,
    location,
  }) => {
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;

    if (!firecrawlApiKey) {
      throw new Error('FIRECRAWL_API_KEY environment variable is not set');
    }

    try {
      const anonymizedQuery = anonymizeQuery(query);
      console.log(`Searching the web (Firecrawl) for: "${anonymizedQuery}"...`);

      const client = new FirecrawlApp({ apiKey: firecrawlApiKey });

      // Build options conservatively and avoid sending undefined fields
      const baseOptions: any = {
        limit: maxResults ?? 5,
        timeout: 120000,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
        },
      };

      if (tbs) baseOptions.tbs = tbs;
      if (Array.isArray(sources) && sources.length > 0) {
        baseOptions.sources = sources;
      } else {
        baseOptions.sources = ['web'];
      }
      if (Array.isArray(categories) && categories.length > 0) {
        baseOptions.categories = categories;
      }
      if (location) baseOptions.location = location;

      const response = await client.search(query, baseOptions);
      // console.log('Firecrawl search response:', response);

      // The SDK returns the data object directly (no `success` wrapper)
      const data = (response as any)?.data ?? (response as any);

      let items: any[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data?.web && Array.isArray(data.web)) {
        items = data.web;
      } else if (Array.isArray((data as any)?.results)) {
        items = (data as any).results;
      } else if (data && typeof data === 'object') {
        const firstArray = Object.values(data).find((v) => Array.isArray(v));
        if (Array.isArray(firstArray)) items = firstArray as any[];
      }

      if (!items || items.length === 0) {
        return {
          results: [],
          message: 'No results found for your search query.',
        };
      }

      const MAX_CHARS_PER_RESULT = 5000;
      const results = items.slice(0, maxResults ?? 5).map((item: any) => {
        const raw = item.markdown || item.content || '';
        const compact = compactMarkdown(raw, MAX_CHARS_PER_RESULT);

        console.log('originalLength', compact.originalLength);
        console.log('content_length', compact.content.length);
        console.log('content_truncated', compact.truncated);

        return {
          title: item.title || 'Untitled',
          url: item.url,
          description: item.description || item.snippet || '',
          extra_snippets: [],
          age: null,
          language: item.language || null,
          content: compact.content,
          content_length: compact.content.length,
          content_truncated: compact.truncated,
          original_length: compact.originalLength,
        } as const;
      });

      return {
        query,
        resultCount: results.length,
        results,
        summary: null,
        message: `Found ${results.length} results for "${query}"`,
        privacy_notice:
          'Search performed via Firecrawl Search API. Query sent; result URLs were fetched to extract markdown content.',
      };
    } catch (error) {
      console.error('Web search error:', error);
      throw new Error(
        `Failed to search the web: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },
});
