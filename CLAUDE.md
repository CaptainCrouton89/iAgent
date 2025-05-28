# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

iAgent is a sophisticated multi-agent AI system built with Next.js 15, featuring conscious thought processing, emotion tracking, persistent memory, and custom tool creation capabilities. It implements a hierarchical agent orchestration system where agents can delegate tasks and share context.

## Commands

```bash
# Development (runs on port 3900 with Turbopack)
pnpm dev

# Build for production
pnpm build

# Lint code
pnpm lint

# Update TypeScript types from Supabase schema
pnpm db:pull

# Add new shadcn/ui components
pnpm dlx shadcn@latest add [component-name]
```

## Architecture

### Multi-Agent System

- **Agent Types**: cursor (programming), planner, observer, architect
- **Task System**: Hierarchical parent-child task relationships stored in `tasks` table
- **Message History**: All agents share a public message space tracked in `agent_message_history`
- **Context Storage**: Unstructured data in `contexts` table for task completion

### Memory Architecture

- **Short-term Memory**: Temporal storage with relevance scoring and vector embeddings
- **Semantic Search**: PostgreSQL with pgvector extension for similarity search
- **Memory Clustering**: Automatic grouping of related memories
- **Persistence**: Conversation saving with embedding generation
- **Auto-Metadata**: Automatic title and summary generation using GPT-4.1-mini for improved memory retrieval

### Stream-Based Communication

- Real-time message streaming using Server-Sent Events
- Edge runtime for API routes
- Background thought streams for conscious processing
- Emotion tracking throughout conversations

### Custom Tools Framework

- Dynamic tool creation with Zod schema validation
- Client-side and server-side execution support
- Versioning system for tool implementations
- Monaco editor integration for code editing

## Key API Patterns

### AI Endpoints (Edge Runtime)

```typescript
// Conscious chat with thought streaming
// POST /api/ai/conscious/chat
// Implements background thought processing with re-prompting

// Memory-augmented chat
// POST /api/memory-chat
// Integrates short-term memory search into responses
// Tools: searchMemories, inspectMemory

// Agent streaming
// POST /api/agents/stream
// Real-time agent message streaming with SSE
```

### Memory System

- **Saving**: Conversations saved with embeddings, compression, and auto-generated metadata
- **Searching**: Semantic similarity search returns memories with IDs
- **Inspecting**: Full transcript access via memory ID
- **Format**: Memory IDs shown as `[ID: uuid]` in search results

### Database Patterns

- All tables use Row Level Security (RLS)
- Foreign keys cascade on delete
- Automatic timestamp updates via triggers
- Vector embeddings stored as `vector(1536)`

## Development Guidelines

### File Organization

- Server actions in `src/actions/`
- API routes use Edge Runtime where applicable
- Protected routes under `(protected)` group
- UI components from shadcn/ui in `src/components/ui/`

### Authentication

- Supabase Auth with email confirmation
- Middleware handles session refresh
- Protected routes require authentication
- Server-side auth checks in API routes

### Tool Development

When creating custom tools:

1. Define Zod schema for inputs
2. Implement async/sync execute function
3. Version tracking for implementations
4. Test via `/private/tools/[id]/test` interface

### Important Notes

- Port 3900 is used for development
- Tailwind v4 with CSS animations
- `database.types.ts` is auto-generated - never edit manually
- Cursor rules should be placed in `.cursor/rules/` directories
- Use pnpm for package management
