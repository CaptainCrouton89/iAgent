# Supabase Database Setup

This document provides instructions for setting up and working with the Supabase database for the iAgent project.

## Tables Created

The database schema consists of the following tables:

1. **Contexts**

   - Used to store text data for context for tasks and agents
   - Includes creation and update timestamps

2. **Agents**

   - Represents different agent types (cursor, planner, observer, architect, etc.)
   - Contains agent properties like title, goal, background
   - Links to context data
   - Tracks activity status

3. **Tasks**

   - Core task management table
   - Supports hierarchical structure (parent-child relationships)
   - Links to owners (agents) and relevant context
   - Tracks status (new, in_progress, done)

4. **Programming_Tasks**
   - Extended information for tasks specifically related to programming
   - Links to the main task and relevant context

## Working with Supabase

- `src/utils/supabase/database.types.ts` contains all the table contents of supabase.
- To make changes to the tables, save a "[descriptive_name].sql" file and indicate to the user that they need to run the script to update the table

After applying migrations, generate TypeScript types with:

### Working with the Database

Use the Supabase client to interact with the database:

```typescript
import { createClient } from "@supabase/supabase-js";
import { Database } from "../supabase/database.types";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

## Important Notes

- The database.types.ts file is auto-generated - do not edit it manually
- Row Level Security (RLS) is enabled for all tables
- Authenticated users have access to read, create, and update records
- Consider using Supabase's Edge Functions for more complex operations
