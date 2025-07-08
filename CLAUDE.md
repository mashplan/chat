# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Development Server
```bash
pnpm dev          # Start development server with turbo
pnpm start        # Start production server
```

### Build and Production
```bash
pnpm build        # Run database migrations and build for production
```

### Code Quality
```bash
pnpm lint         # Run Next.js ESLint and Biome linter with auto-fix
pnpm lint:fix     # Run linters with fixes
pnpm format       # Format code with Biome
```

### Database Operations
```bash
pnpm db:generate  # Generate Drizzle schema
pnpm db:migrate   # Run database migrations
pnpm db:studio    # Open Drizzle studio
pnpm db:push      # Push schema to database
```

### Testing
```bash
pnpm test         # Run Playwright e2e tests
```

## Architecture Overview

### Framework Stack
- **Next.js 15** with App Router and React Server Components
- **AI SDK v5 beta** for LLM integration with streaming support
- **Drizzle ORM** with PostgreSQL for data persistence
- **NextAuth.js v5** for authentication
- **Tailwind CSS** + **shadcn/ui** for styling
- **Biome** for linting and formatting

### Key Directory Structure
```
app/
├── (auth)/           # Authentication pages and API routes
├── (chat)/           # Main chat interface and API routes
└── globals.css       # Global styles

lib/
├── ai/               # AI models, providers, and tools
├── db/               # Database schema, queries, and migrations
├── artifacts/        # Artifact system for generated content
└── editor/           # Rich text editor configuration

components/           # Reusable UI components
artifacts/           # Artifact rendering (code, text, image, sheet)
hooks/               # Custom React hooks
tests/               # Playwright e2e and route tests
```

### Database Schema
The application uses a PostgreSQL database with the following key entities:
- **User** - User accounts with email/password
- **Chat** - Chat sessions with visibility settings
- **Message_v2** - Chat messages with parts and attachments (v2 schema)
- **Vote_v2** - Message voting system
- **Document** - Artifacts (text, code, image, sheet)
- **Suggestion** - Document editing suggestions
- **Stream** - Streaming chat sessions

Note: Legacy v1 schemas (Message, Vote) are deprecated but still present for migration purposes.

### AI Integration
- **Primary Models**: xAI Grok models (grok-2-vision-1212, grok-3-mini-beta)
- **Model Types**: 
  - `chat-model` - Main conversational model
  - `chat-model-reasoning` - Advanced reasoning with `<think>` tags
  - `title-model` - Chat title generation
  - `artifact-model` - Artifact content generation
- **Provider**: Custom provider with test environment fallbacks
- **Tools**: Weather API, document creation/updates, suggestions

### Artifacts System
The application supports four types of artifacts:
1. **Text** - Rich text documents with ProseMirror editor
2. **Code** - Syntax-highlighted code with CodeMirror
3. **Image** - AI-generated images with editing capabilities
4. **Sheet** - Spreadsheet functionality with react-data-grid

### Authentication Flow
- NextAuth.js v5 with email/password and guest user support
- Session management with JWT tokens
- Protected routes using middleware

### Testing Strategy
- **Playwright** for e2e testing with separate test projects:
  - `e2e/` - Full user journey tests
  - `routes/` - API route testing
- Test environment uses mock AI models
- Parallel test execution with trace collection on failure

## Development Notes

### Code Style
- **Biome** configuration enforces consistent formatting
- **ESLint** with Next.js and accessibility rules
- 2-space indentation, 80-character line width
- Single quotes for JS/TS, double quotes for JSX

### Environment Setup
- Requires `.env.local` file with database and API credentials
- Uses `pnpm` as package manager
- Database migrations run automatically before build

### Database Migrations
- Drizzle handles schema migrations in `lib/db/migrations/`
- Run `pnpm db:generate` after schema changes
- Migration files are auto-generated and should not be manually edited

### Performance Considerations
- Next.js PPR (Partial Pre-rendering) enabled
- React Server Components for server-side rendering
- Streaming responses for real-time chat
- SWR for client-side data fetching and caching