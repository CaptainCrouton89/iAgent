# Protected Private Routes

This directory contains all authenticated user interfaces for the iAgent system.

## Route Structure

All routes under `(protected)` require authentication via Supabase Auth middleware.

### /private/memory
- Memory-augmented chat interface
- AI with access to conversation history
- Emotion tracking and personality system
- Save conversations for long-term memory

### /private/chat
- Multi-agent chat system
- Agent selection (cursor, planner, observer, architect)
- Hierarchical task management
- Real-time streaming responses

### /private/conscious
- Conscious thought processing interface
- Background thought streams
- Re-prompting based on thought quality
- Experimental consciousness features

### /private/configure-agents
- Agent management interface
- Create, edit, delete agents
- Set agent relationships (boss hierarchy)
- Configure agent goals and backgrounds

### /private/tools
- Custom tool creation and management
- Monaco editor for tool implementation
- Zod schema validation
- Tool testing interface at `/tools/[id]/test`

## Common Patterns

### Authentication Check
All pages inherit auth protection from layout.tsx

### Streaming Responses
Most chat interfaces use:
```typescript
const response = await fetch('/api/...', {
  method: 'POST',
  body: JSON.stringify({ messages })
});
const reader = response.body.getReader();
```

### State Management
- Local React state for UI
- Server state via API calls
- No global state management library

## UI Components

Uses shadcn/ui components:
- Form controls from `@/components/ui`
- Consistent styling with Tailwind CSS
- Dark mode support where implemented

## Message Format

Standard message structure across chat interfaces:
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  parts?: MessagePart[];
}
```

Parts can include text, tool calls, and tool results.