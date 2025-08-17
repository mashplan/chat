# Brave Search API Setup

This document describes how to set up Brave Search API for web search functionality in the chat application.

## Overview

Brave Search provides a privacy-focused search API that allows your chat app to search the web without compromising user privacy. While the search queries are sent to Brave (US company), no user conversations or personal data are transmitted.

## Privacy Considerations

### What Gets Sent to Brave:
- ✅ Search queries only (e.g., "renewable energy Sweden")
- ✅ Your API key for authentication
- ✅ Request metadata (from your server, not users)

### What Does NOT Get Sent:
- ❌ User conversations
- ❌ User identities
- ❌ Chat context
- ❌ Personal information

### Legal Jurisdiction:
- Your company remains under Swedish/EU law
- Only search queries cross borders
- CLOUD Act cannot compel you to provide user data
- All conversations stay in your Swedish infrastructure

## Setup Instructions

### 1. Get a Brave Search API Key

1. Visit [https://api.search.brave.com/](https://api.search.brave.com/)
2. Create an account
3. Choose a plan:
   - **Free tier**: 2,000 queries/month
   - **Basic**: $5/month for 20,000 queries
   - **Professional**: Higher tiers available
4. Copy your API key

### 2. Add to Environment Variables

Add the API key to your chat application's environment:

```bash
# For local development (.env file)
BRAVE_API_KEY=your-brave-api-key-here

# For Scaleway deployment
# Add in the Scaleway Console under Container Settings > Environment Variables
```

### 3. Deploy Your Application

The search tool is already integrated and will automatically use the Brave API when the key is present.

## Usage

The AI assistant can now search the web when users ask for current information:

```
User: "What's the latest news about renewable energy in Sweden?"
AI: *searches the web* According to recent news...
```

## Features

### Search Options
- **Basic search**: General web search
- **Freshness filters**: Search by recency (past day, week, month, year)
- **Safe search**: Moderate content filtering enabled by default
- **Result count**: Up to 20 results per search

### Privacy Features
- Query anonymization (removes emails, IPs, long numbers)
- No full page content fetching (uses snippets only)
- Clear privacy notice in results
- Minimal logging

## API Limits

- **Free tier**: 2,000 queries/month
- **Rate limit**: 1 query/second (free), higher for paid
- **Result limit**: 20 results per query

Monitor your usage at: https://api.search.brave.com/app/dashboard

## Fallback Options

If you prefer not to use Brave Search:

1. **No search**: Disable the search tool entirely
   - Remove `searchWeb` from the active tools list in your chat route
   - Users can still use URL scraping for specific pages

2. **Alternative search APIs**: You could integrate other search providers
   - DuckDuckGo API (if available)
   - Google Custom Search API
   - Microsoft Bing Search API

## Compliance Notes

For GDPR compliance:
1. Document in your privacy policy that search queries may be processed by Brave (US)
2. Emphasize that only queries are sent, not conversations
3. Provide users with opt-out options if required

Example privacy policy snippet:
```
Web search functionality is powered by Brave Search. When you ask 
our AI to search the web, only the search query is sent to Brave's 
servers (located in the US). Your conversations and personal data 
remain on our EU servers and are never shared with third parties.
```

## Troubleshooting

### "BRAVE_API_KEY environment variable is not set"
- Ensure the API key is added to your environment
- Restart your application after adding the key

### "Brave Search API error: 403"
- Check if your API key is valid
- Verify you haven't exceeded your monthly quota

### No search results
- Try a different query
- Check Brave's status page: https://status.brave.com/

## Support

- Brave Search API docs: https://api.search.brave.com/app/documentation
- API status: https://status.brave.com/
- Support: support@brave.com
