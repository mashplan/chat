import { tool } from 'ai';
import { z } from 'zod';

// Anonymize queries to protect user privacy
function anonymizeQuery(query: string): string {
  // Remove potential personal identifiers
  return query
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, 'EMAIL') // Remove emails
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'IP_ADDRESS'); // Remove IPs
}

export const searchWeb = tool({
  description:
    'Search the web for information. Use this when you need current information, facts, or data not in your training.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    maxResults: z
      .number()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe('Maximum number of results to return'),
    freshness: z
      .enum(['pd', 'pw', 'pm', 'py', 'all'])
      .optional()
      .describe(
        'Filter by recency: pd=past day, pw=past week, pm=past month, py=past year',
      ),
  }),
  execute: async ({ query, maxResults, freshness }) => {
    const braveApiKey = process.env.BRAVE_API_KEY;

    if (!braveApiKey) {
      throw new Error('BRAVE_API_KEY environment variable is not set');
    }

    try {
      // Anonymize the query for privacy
      const anonymizedQuery = anonymizeQuery(query);
      console.log(`Searching the web for: "${anonymizedQuery}"...`);

      // Build the search URL with parameters
      const searchParams = new URLSearchParams({
        q: query,
        count: String(maxResults || 5),
        result_filter: 'web',
        safesearch: 'moderate',
        text_decorations: '0',
      });

      if (freshness && freshness !== 'all') {
        searchParams.append('freshness', freshness);
      }

      const searchResponse = await fetch(
        `https://api.search.brave.com/res/v1/web/search?${searchParams}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': braveApiKey,
          },
        },
      );

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        throw new Error(
          `Brave Search API error: ${searchResponse.status} - ${errorText}`,
        );
      }
      console.log('BRAVE SEARCH API IN USE');

      const searchData = await searchResponse.json();

      if (!searchData.web?.results || searchData.web.results.length === 0) {
        return {
          results: [],
          message: 'No results found for your search query.',
        };
      }

      // Transform Brave results to our format
      const results = searchData.web.results
        .slice(0, maxResults)
        .map((result: any) => ({
          title: result.title || 'Untitled',
          url: result.url,
          description: result.description || '',
          // Brave provides extra rich snippets we can use
          extra_snippets: result.extra_snippets || [],
          age: result.age || null,
          language: result.language || null,
          // For privacy, we're not fetching full content - just using snippets
          content:
            result.description + (result.extra_snippets?.join(' ') || ''),
        }));

      // Add summary if available
      const summary = searchData.summarizer?.summary;

      return {
        query,
        resultCount: results.length,
        results,
        summary: summary || null,
        message: `Found ${results.length} results for "${query}"`,
        // Include privacy notice
        privacy_notice:
          'Search performed via Brave Search API. Only search query was sent.',
      };
    } catch (error) {
      console.error('Web search error:', error);
      throw new Error(
        `Failed to search the web: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },
});
