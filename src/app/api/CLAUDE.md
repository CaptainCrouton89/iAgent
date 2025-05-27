# API Routes Directory

This directory contains all API endpoints for the iAgent system. All routes use Next.js 15 App Router conventions.

## Key API Endpoints

### Memory System (`/memory`, `/memory-chat`)
- **`/memory`**: Saves conversations with embeddings and compression
- **`/memory-chat`**: Chat interface with memory augmentation
  - Uses `memorySearchTool` and `memoryInspectTool`
  - Implements conversational partner personality
  - Tracks emotional state and interaction lessons

### AI Endpoints (`/ai/`)
- **`/ai/conscious/chat`**: Conscious thought processing with background thoughts
- **`/ai/emotion`**: Emotion analysis and tracking
- Edge runtime for streaming responses

### Agent System (`/agents/`)
- **`/agents`**: CRUD operations for agents
- **`/agents/stream`**: Real-time agent communication
- **`/agents/[id]`**: Individual agent operations
- Supports hierarchical agent relationships (boss_id)

### Custom Tools (`/custom-tools/`)
- Dynamic tool creation and management
- Server-side execution with Zod validation
- Version tracking for implementations

## Authentication Pattern

All protected routes use Supabase Auth:
```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return new Response("Unauthorized", { status: 401 });
```

## Streaming Pattern

For AI responses with tool usage:
```typescript
const result = streamText({
  model: openai("gpt-4.1"),
  messages,
  tools: { /* tool definitions */ },
  toolCallStreaming: true,
  maxSteps: 20,
});
return result.toDataStreamResponse();
```

## Database Access

- Always use `createClient()` from `@/utils/supabase/server`
- RLS policies automatically filter by auth_id
- Vector operations use pgvector functions