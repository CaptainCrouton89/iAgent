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

## Migration Files

Two migration files have been created:

- `supabase/migrations/20240601_create_tables.sql`: Creates the tables with appropriate constraints and indexes
- `supabase/migrations/20240601_add_rls_policies.sql`: Sets up Row Level Security policies for the tables

## Working with Supabase

### Running Migrations

To apply the migrations to your Supabase project:

1. Install Supabase CLI if you haven't already:

   ```
   pnpm install -g supabase
   ```

2. Login to Supabase:

   ```
   supabase login
   ```

3. Link your project (if not already linked):

   ```
   supabase link --project-ref <your-project-ref>
   ```

4. Apply the migrations:
   ```
   supabase db push
   ```

### Generating TypeScript Types

After applying migrations, generate TypeScript types with:

```
pnpm supabase:types
```

This will update the `supabase/database.types.ts` file with the latest type definitions based on your database schema.

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
