# Supabase Utilities

This directory contains Supabase client configurations and database utilities.

## Client Types

### server.ts

- Server-side Supabase client for API routes
- Handles cookie-based authentication
- Use for all server-side operations

### client.ts

- Browser-side Supabase client
- For client components and hooks
- Manages auth state in browser

### middleware.ts

- Supabase middleware for auth refresh
- Ensures sessions stay valid
- Handles protected route access

## Database Types

### database.types.ts

- **AUTO-GENERATED** - Never edit manually
- Generated from Supabase schema using `pnpm db:pull`
- Contains all table types, RPC functions, and enums

## Key Tables

### memories

- Stores conversation history with embeddings
- Fields: id, auth_id, content (Message[]), compressed_conversation, embedding
- RLS: Users can only access their own memories

### agents & tasks

- Hierarchical agent system
- Parent-child task relationships
- Context storage in separate table

### assistant_settings

- User-specific AI preferences
- Interaction lessons extracted from conversations
- Optimized periodically to remove redundancy

## Vector Operations

### search_memories RPC

- Semantic search using pgvector
- Returns memories with similarity scores
- Parameters: query_embedding, match_threshold, match_count

### Memory Search Utility (memory-search.ts)

- Wrapper around search_memories RPC
- Generates embeddings for queries
- Returns typed MemorySearchResult[]

## Best Practices

1. Always use typed database operations
2. Let RLS handle user filtering (don't manually filter by auth_id in queries)
3. Use RPC functions for complex vector operations
4. Handle errors gracefully - Supabase operations can fail
