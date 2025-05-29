# Cron Jobs Documentation

## Overview

The iAgent system uses Vercel Cron to schedule periodic tasks. All cron jobs are configured in `vercel.json` and can be manually triggered via the dashboard at `/private/cron`.

## Available Cron Jobs

### 1. Memory Refresh
- **Path**: `/api/cron/ai/memory`
- **Schedule**: Daily at 3 AM UTC (`0 3 * * *`)
- **Purpose**: Updates assistant settings based on saved memories
- **Process**:
  1. Fetches recent memories for each user
  2. Extracts interaction patterns using GPT-4
  3. Updates assistant_settings table
  4. Removes redundant lessons

### 2. Memory Decay
- **Path**: `/api/cron/ai/memory/decay`
- **Schedule**: Daily at 2 AM UTC (`0 2 * * *`)
- **Purpose**: Manages memory storage by decaying old memories
- **Process**:
  1. Identifies memories older than 30 days
  2. Reduces strength value gradually
  3. Deletes memories with strength below threshold
  4. Skips pinned memories

### 3. Semantic Extraction
- **Path**: `/api/cron/ai/semantic-extraction`
- **Schedule**: Weekly on Sundays at 4 AM UTC (`0 4 * * 0`)
- **Purpose**: Extracts semantic knowledge from episodic memories
- **Process**:
  1. Processes last 24 hours of episodic memories per user
  2. Extracts facts, themes, and summaries using GPT-4
  3. Deduplicates via 85% similarity threshold
  4. Increases confidence for repeated observations
  5. Runs semantic memory decay

## Manual Triggering

All cron jobs can be manually triggered from the dashboard:

1. Navigate to `/private/cron`
2. Click "Trigger Manually" for the desired job
3. Confirm in the dialog
4. Monitor the result message

## Security

- All cron endpoints require `CRON_SECRET` authorization header
- Manual triggers via dashboard require user authentication
- The trigger API validates user session before execution

## Adding New Cron Jobs

1. Create new route in `/api/cron/` directory
2. Add authorization check:
   ```typescript
   const authorization = headers.get("authorization");
   if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   }
   ```
3. Add to `vercel.json`:
   ```json
   {
     "path": "/api/cron/your-job",
     "schedule": "0 0 * * *"
   }
   ```
4. Update dashboard in `/private/cron/page.tsx`
5. Add handler to `/api/cron/trigger/route.ts`

## Monitoring

- Each job returns success/error status
- Results visible in Vercel Functions logs
- Manual triggers show immediate feedback in UI