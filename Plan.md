# Memory Metadata Enhancement Plan

## Overview

Enhance the memory system with intelligent metadata, decay mechanics, and improved search ranking for more sophisticated conversation memory retention.

## 1. Database Updates

✅ **Already Complete** - The `memories` table has been updated with:
- `label` VARCHAR(50)
- `strength` FLOAT
- `last_used` TIMESTAMPTZ
- `pinned` BOOLEAN

## 2. Memory Save Enhancement (`src/actions/memory-chat.ts`)

### Update `generateTitleAndSummary` to `generateMemoryMetadata`:

- Generate title and summary (existing)
- Generate label based on conversation content
- Calculate initial strength based on conversation importance
- Set `last_used` to creation time (not on every retrieval)
- Determine if content should be pinned
- Return array of memory IDs that were used in the conversation

### Label Categories (for user conversations):

- `important`: Core user info, critical decisions, key facts
- `user_profile`: Personal info, preferences, habits, names
- `project_x`: Project-specific memories (dynamic labels)
- `temporary`: Time-sensitive info, transient context
- `trivial`: Small talk, low-value exchanges
- `general`: Default category

### Strength Calculation:

- Base strength: 0.5-0.9 depending on content quality
- Boost for: Questions answered, problems solved, new information learned
- Reduce for: Repetitive content, small talk, no clear outcome

### Auto-pin Logic:

- User's name when first mentioned
- Key personal identifiers
- Explicitly marked important information
- Core preferences that affect all interactions

## 3. Memory Usage Tracking

### When saving a conversation:
1. Analyze which memories from search were actually relevant
2. Update `last_used` timestamp for those memories only
3. Boost strength by +0.1 (larger boost) for used memories
4. Track memory IDs in conversation metadata

### When using `inspectMemory` tool:
- Update `last_used` for that specific memory
- Boost strength by +0.1

## 4. Memory Search Enhancement (`src/tools/memory-search.ts`)

### Enhanced Ranking Algorithm:

1. Fetch 3x requested limit from database (to allow better ranking)
2. Get all metadata fields including new ones
3. Calculate composite score for each memory:
   ```
   score = (similarity * 0.4) +
           (strength * 0.3) +
           (recency_score * 0.2) +
           (label_importance * 0.1)
   ```
4. Apply modifiers:
   - Pinned memories: +1.0 to score
   - Label importance multipliers:
     - `important`: 1.5x
     - `user_profile`: 1.3x
     - `project_*`: 1.2x
     - `general`: 1.0x
     - `temporary`: 0.8x
     - `trivial`: 0.5x
5. Sort by composite score
6. Return top N results as requested

### Recency Score:

- Calculate based on `last_used` timestamp
- Exponential decay: `recency_score = exp(-days_since_used / 30)`

## 5. Memory Decay Cron Job

### Endpoint: `/api/cron/ai/memory/decay`

- Run daily at 2 AM UTC
- Process all non-pinned memories

### Decay Formula:

```typescript
// Base decay rate per day (adjusted for typical starting strength 0.5-0.7)
const baseDecayRate = {
  important: 0.001,      // -0.1% per day (never deleted)
  user_profile: 0.001,   // -0.1% per day (~1-2 years to deletion)
  general: 0.003,        // -0.3% per day (~4-6 months to deletion)
  temporary: 0.01,       // -1% per day (~6-8 weeks to deletion)
  trivial: 0.02,         // -2% per day (~3-4 weeks to deletion)
};

// Apply decay based on days since last_used
newStrength = currentStrength - (baseDecayRate[label] * daysSinceLastUsed);

// Deletion criteria
if (label !== "important" && strength < 0.1) {
  deleteMemory();
}
```

### Additional Rules:

- Never decay pinned memories
- Minimum strength: 0.0
- Log decay operations for monitoring

## 6. Implementation Order

1. **Update Save Function** ✅
   - Enhance metadata generation
   - Track used memories from search

2. **Update Search Function**
   - Implement enhanced ranking with metadata
   - Test ranking algorithm

3. **Create Decay Cron Job**
   - Implement decay logic
   - Add to Vercel cron configuration

4. **Add Usage Tracking**
   - Update memory strength/last_used on actual usage
   - Track in conversation save and inspect tool

## 7. Database Function Updates Needed

Update `search_memories_by_date` to return all metadata:
- Add `title`, `summary`, `label`, `strength`, `last_used`, `pinned` to return type

## 8. Testing Strategy

- Test label generation accuracy
- Verify ranking improvements
- Monitor decay rates
- Ensure pinned memories persist
- Performance testing with large datasets

## 8. Future Enhancements

- User-adjustable decay rates
- Manual label/pin editing
- Memory clustering by project
- Export/import memory sets
- Analytics dashboard for memory health
