# Firecrawl Cloud API Setup

This document describes how to set up Firecrawl Cloud API for URL scraping functionality in the chat application.

## Overview

Firecrawl Cloud provides a hosted API for scraping individual URLs and converting them to LLM-ready markdown. This complements the Brave Search API by allowing users to provide specific URLs they want analyzed.

## Use Cases

The `scrapeUrl` tool is used when:
- User provides a specific URL: "Analyze this article: https://example.com"
- User asks about content on a specific page
- User wants to extract information from a document or blog post

This is different from `searchWeb` which searches the internet for information.

## Privacy Considerations

### What Gets Sent to Firecrawl (US Company):
- ✅ The specific URL to scrape
- ✅ Your API key for authentication
- ✅ Scraping parameters (format, timeout, etc.)

### What Does NOT Get Sent:
- ❌ User conversations
- ❌ Why the user wants to scrape the URL
- ❌ Other chat context
- ❌ User personal information

### Legal Jurisdiction:
- Same considerations as Brave Search API
- Only the URL and scraping request cross borders
- All conversations remain in your Swedish infrastructure

## Setup Instructions

### 1. Get a Firecrawl API Key

1. Visit [https://firecrawl.dev](https://firecrawl.dev)
2. Sign up for an account
3. Choose a plan:
   - **Free tier**: 500 scrapes/month
   - **Starter**: $20/month for 5,000 scrapes
   - **Standard**: $50/month for 20,000 scrapes
4. Get your API key from the dashboard

### 2. Add to Environment Variables

Add the API key to your chat application's environment:

```bash
# For local development (.env.local file)
FIRECRAWL_API_KEY=fc-your-api-key-here

# For Scaleway deployment
# Add in the Scaleway Console under Container Settings > Environment Variables
```

### 3. Deploy Your Application

The scrape tool is already integrated and will automatically use the Firecrawl Cloud API when the key is present.

## Usage Examples

Users can now ask:

```
"Analyze this article: https://techcrunch.com/article"
"What does this page say about pricing? https://company.com/pricing"
"Summarize the content from https://blog.example.com/post"
```

The AI will automatically use the `scrapeUrl` tool to fetch and analyze the content.

## Features

### Scraping Options
- **Markdown format**: Clean, LLM-ready text
- **HTML format**: Full HTML if needed
- **Main content only**: Removes navigation, ads, footers
- **Metadata extraction**: Title, description, Open Graph data
- **Error handling**: Graceful handling of blocked/unavailable pages

### Supported Content
- Web pages and articles
- Blog posts and documentation
- PDF documents (converted to text)
- Most public web content

### Limitations
- Cannot scrape pages behind authentication
- Some sites may block automated access
- Large pages may be truncated
- Rate limits apply based on your plan

## API Limits

- **Free tier**: 500 scrapes/month
- **Starter**: 5,000 scrapes/month ($20)
- **Standard**: 20,000 scrapes/month ($50)
- **Rate limit**: Varies by plan

Monitor your usage at: https://firecrawl.dev/dashboard

## Complementary Tools

Your chat app now has both:

1. **`searchWeb`** (Brave API): Search the internet for information
   - "What's the latest news about AI?"
   - "Find information about renewable energy"

2. **`scrapeUrl`** (Firecrawl API): Analyze specific URLs
   - "Analyze this article: https://example.com"
   - "What does this page say about pricing?"

## Error Handling

The tool provides helpful error messages:
- **Timeout**: Page too slow to load
- **Access denied**: Page blocks automated access
- **Not found**: Invalid or broken URL
- **Rate limit**: Too many requests

## Privacy Policy Update

Add to your privacy policy:
```
URL scraping is powered by Firecrawl. When you ask our AI to analyze 
a specific URL, only that URL is sent to Firecrawl's servers (US). 
Your conversations remain on our EU servers.
```

## Troubleshooting

### "FIRECRAWL_API_KEY environment variable is not set"
- Ensure the API key is added to your environment
- Restart your application after adding the key
- Check the key format starts with `fc-`

### "Firecrawl API error: 403"
- Verify your API key is valid
- Check you haven't exceeded your monthly quota
- Ensure the URL is publicly accessible

### "Timeout while scraping"
- Some pages load slowly or require JavaScript
- Try the URL in a browser to verify it works
- Large pages may take longer to process

## Support

- Firecrawl documentation: https://docs.firecrawl.dev
- Dashboard: https://firecrawl.dev/dashboard  
- Support: support@mendable.ai
