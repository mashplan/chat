import { tool } from 'ai';
import { z } from 'zod';

export const scrapeUrl = tool({
  description:
    'Scrape content from a specific URL and convert it to markdown. Use this when the user provides a specific URL they want you to analyze or get content from.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to scrape'),
    formats: z
      .array(z.enum(['markdown', 'html']))
      .optional()
      .default(['markdown'])
      .describe('Output formats - markdown is recommended for LLM processing'),
    onlyMainContent: z
      .boolean()
      .optional()
      .default(true)
      .describe('Extract only main content, excluding navigation, ads, etc.'),
  }),
  execute: async ({ url, formats, onlyMainContent }) => {
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;

    if (!firecrawlApiKey) {
      throw new Error('FIRECRAWL_API_KEY environment variable is not set');
    }

    try {
      console.log(`Scraping URL: ${url}`);

      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firecrawlApiKey}`,
        },
        body: JSON.stringify({
          url,
          formats,
          onlyMainContent,
          timeout: 300000, // 5 minutes timeout
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Firecrawl API error: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(`Scraping failed: ${data.error || 'Unknown error'}`);
      }

      const title = data.data?.metadata?.title || 'Untitled';

      const result = {
        url,
        success: true,
        data: {
          markdown: data.data?.markdown || '',
          html: data.data?.html || '',
          metadata: {
            title: data.data?.metadata?.title || 'Untitled',
            description: data.data?.metadata?.description || '',
            language: data.data?.metadata?.language || null,
            sourceURL: data.data?.metadata?.sourceURL || url,
            statusCode: data.data?.metadata?.statusCode || null,
            ogTitle: data.data?.metadata?.ogTitle || '',
            ogDescription: data.data?.metadata?.ogDescription || '',
            ogImage: data.data?.metadata?.ogImage || '',
          },
        },
        message: `Successfully scraped content from ${url}`,
      };

      return result;
    } catch (error) {
      console.error('URL scraping error:', error);

      // Provide helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new Error(
            `⏰ Timeout while scraping ${url}. The page may be slow to load or require authentication.`,
          );
        }
        if (error.message.includes('403') || error.message.includes('401')) {
          throw new Error(
            `🚫 Access denied to ${url}. The page may require authentication or block automated access.`,
          );
        }
        if (error.message.includes('404')) {
          throw new Error(
            `🔍 Page not found: ${url}. Please check if the URL is correct.`,
          );
        }
      }

      throw new Error(
        `Failed to scrape URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },
});
