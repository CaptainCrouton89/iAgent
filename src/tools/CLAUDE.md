# Tools Directory

This directory contains AI tools that can be used by various agents in the system.

## Available Tools

### memorySearchTool
- **Purpose**: Search for previous conversations using semantic similarity
- **Location**: `memory-search.ts`
- **Returns**: Formatted list of memories with IDs, timestamps, and relevance scores
- **Note**: Memory IDs are included in format `[ID: uuid]` for use with other tools

### memoryInspectTool
- **Purpose**: Inspect raw conversation transcript of a specific memory
- **Location**: `memory-inspect.ts`
- **Parameters**:
  - `memoryId`: UUID of the memory (obtained from memorySearchTool)
  - `startIndex`: Optional starting message index
  - `endIndex`: Optional ending message index
- **Returns**: Full conversation transcript with message details

### sequentialThinkingTool
- **Purpose**: Enable step-by-step thinking for complex problems
- **Location**: `sequential-thinking.ts`
- **Usage**: Helps AI break down complex tasks into manageable steps

### AgentHyveClient & PerplexityClient
- External service integrations for extended capabilities

## Integration Pattern

Tools are registered in API routes like:
```typescript
tools: {
  searchMemories: memorySearchTool,
  inspectMemory: memoryInspectTool,
}
```

## Adding New Tools

1. Create tool using `tool()` from "ai" package
2. Define Zod schema for parameters
3. Implement execute function
4. Export from `index.ts`
5. Add to relevant API routes
6. Update UI components if needed (see `ToolResponse.tsx`)