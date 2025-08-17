# Web Search Setup - Brave Search Integration

## Quick Summary

We've integrated Brave Search API for web search functionality. This provides:
- ✅ Privacy-focused search (Brave doesn't track users)
- ✅ Simple setup (just add API key)
- ✅ GDPR-compliant approach (only queries sent, not conversations)
- ✅ Reliable results without anti-bot issues

## What We Added

1. **Web search tool** (`lib/ai/tools/search-web.ts`):
   - Uses Brave Search API for general web searches
   - Includes query anonymization
   - Returns search snippets with metadata
   - Added freshness filters

2. **URL scraping tool** (`lib/ai/tools/scrape-url.ts`):
   - Uses Firecrawl Cloud API for specific URL content
   - Converts web pages to clean markdown
   - Extracts metadata and main content
   - Handles various content types

3. **Environment variables**:
   - `BRAVE_API_KEY` for web search
   - `FIRECRAWL_API_KEY` for URL scraping

## Setup Instructions

### 1. Get API Keys

**For Web Search (Brave):**
1. Go to [https://api.search.brave.com/](https://api.search.brave.com/)
2. Sign up (free tier: 2,000 searches/month)
3. Copy your API key

**For URL Scraping (Firecrawl):**
1. Go to [https://firecrawl.dev](https://firecrawl.dev)
2. Sign up (free tier: 500 scrapes/month)
3. Copy your API key

### 2. Add to Environment

**Local Development:**
```bash
# Add to .env.local file
BRAVE_API_KEY=your-brave-api-key-here
FIRECRAWL_API_KEY=fc-your-firecrawl-api-key-here
```

**Scaleway Deployment:**
Add both keys to Container Settings > Environment Variables

### 3. Deploy

That's it! The search tool will automatically work when the key is present.

## Usage

**General Web Search:**
- "What's the latest news about renewable energy?"
- "Search for GDPR compliance requirements"
- "Find information about Swedish tech companies"

**Specific URL Analysis:**
- "Analyze this article: https://example.com/article"
- "What does this page say about pricing? https://company.com/pricing"
- "Summarize the content from https://blog.example.com/post"

## Privacy & Compliance

**What happens:**
1. User asks a question needing current info
2. AI generates a search query
3. Only the query goes to Brave (US)
4. Results come back as snippets
5. AI uses snippets to answer

**Privacy notice for your terms:**
```
Web searches powered by Brave Search and URL scraping by Firecrawl. 
Only search queries and specific URLs are sent to improve results. 
All conversations remain on EU servers.
```

## Costs

**Brave Search:**
- **Free**: 2,000 searches/month
- **Basic**: $5/month for 20,000 searches
- **Pro**: Contact Brave

**Firecrawl:**
- **Free**: 500 scrapes/month
- **Starter**: $20/month for 5,000 scrapes
- **Standard**: $50/month for 20,000 scrapes

Most apps can start with the free tiers.

## Support

- [Brave API Documentation](https://api.search.brave.com/app/documentation)
- [Firecrawl Documentation](https://docs.firecrawl.dev)
- [Firecrawl Cloud Setup Guide](firecrawl-cloud-setup.md)
