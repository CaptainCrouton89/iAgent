# Semantic Memory Implementation

## Overview

The semantic memory system has been implemented with the following features:

1. **Database Schema**: New `semantic_memories` table with:
   - Types: `fact`, `theme`, `summary`
   - Confidence scoring and strength decay
   - Provenance tracking (links to source episodic memories)
   - Related memories array for knowledge graph connections

2. **Extraction Service**: `src/actions/semantic-memory.ts`
   - Extracts semantic knowledge from episodic memories using GPT-4
   - Automatic deduplication via similarity threshold (85%)
   - Confidence reinforcement for repeated observations

3. **Search Integration**: Updated memory search tools to support:
   - `memoryType`: "episodic", "semantic", or "hybrid"
   - `semanticType`: Filter by "fact", "theme", or "summary"
   - Hybrid mode returns both episodic and semantic results

4. **Dream Phase Cron**: `src/app/api/cron/ai/semantic-extraction/route.ts`
   - Runs periodically to extract semantic memories from recent episodes
   - Processes last 24 hours of conversations
   - Includes memory decay for outdated semantic knowledge

## Usage Examples

### Search for Semantic Memories Only
```typescript
// In memory-chat conversation
"Search for facts about my preferences"
// Tool will use memoryType: "semantic", semanticType: "fact"
```

### Hybrid Search (Default)
```typescript
// Searches both episodic and semantic memories
"What do you know about my work habits?"
// Returns relevant conversations AND extracted facts/themes
```

### Semantic Memory Format
```
Fact 1 [ID: uuid] (Relevance: 85%, Confidence: 75%):
User prefers dark mode interfaces and minimalist design

Theme 1 [ID: uuid] (Relevance: 90%, Confidence: 80%):
User values efficiency and automation in workflow tools
```

## Architecture Notes

- Semantic memories are extracted asynchronously via cron job
- Deduplication prevents memory bloat through similarity matching
- Confidence scores increase with repeated observations
- Strength decay removes outdated or rarely-accessed knowledge
- Provenance tracking maintains links to source conversations

## Future Enhancements

1. Knowledge graph visualization using `related_memories`
2. Manual semantic memory curation interface
3. Contradiction detection and resolution
4. Temporal reasoning for fact evolution