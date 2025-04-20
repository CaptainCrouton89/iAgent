## New Tables:

### Task Table (created via chat)

- Each task can have a parent
- Has a status (new, in progress, done)
- Owner: A crew member who owns that task and is responsible for completing it
- Context: Text file with lots of unstructured data, used for solving task

### Programming Task Table

- Each task has a parent task from the task table
- Description: The actual instructions for cursor
- Context: The additional useful information text

### Agent Table

- Agent title
- Agent goal (What it's trying to achieve)
- Agent background
- Agent context (passed with all of its prompts)
- Agent log: Text field of last actions

# How it works

- Cursor agent mode is in while loop:
  1. fetch the next task and implement it. Do not stop doing so.
  2. If the problem is too large, feed it back to the orchestrator
  3. Keep polling until you can go again (via tool call)
- Planner Agent
  1. You say what you want to get done
  2. It determines how it needs to get broken down, and may ask you more questions
  3. Breaks down task a lot further, does initial research on necessary contexts

## Processes

1. Observer
   1. Polls contexts, agents, etc, and updates blackboard context

## Tools

1. Get task tree: fetches task and all child tasks
2. Get task details: Fetches task with its context
3. Delegate: Pass a task id and get back an "answer" to the task (works on research and architect, but maybe code too??)
   1. Marks the task as in progress
   2. Should spin up a new agent, (and pass it the context? or does agent make its own?)
   3. Agent immediately claims the task
4. Delegate Cusor Task:
   1. Describes the task in detail
   2. Saves it to a table
5. Write to context
   1. At start of task, should write everything it learns to context
6.

Autopruner: Running in parallel process, is managing context

- Polls context, and polls active agents and their tasks

I tell cursor:

1. Analyze everything, refactor this to use the Vercel SDK
2. Make a new page using this as a template. It should do XYZ
3. Make a personal CRM. Plan it and implement it.

Enqueuing agent tasks vs async agent tasks

1. Ex 1

   1. Super Agent (SA) starts looking at files
   2. SA asks clarifying questions
   3. SA writes intial problem/goal context with goalId, and enqueues the task id. (or alternatively, doesn't, and relies on the polling from the cursor agent). If the task is cursor, it doesn't enqueue, otherwise it does.

   ## Cursor agent:

   1. Retrieves "full context"
      1. Gets the public messages
      2. Gets overarching goal
      3. Gets the task with context
      4. Who the team is
   2. Gets to work implementing,

   ## Non-cursor agent:

   3. Retrieves full context
      1. Public messages
      2. Task with context
      3. Recent memories
      4. Who the team is
   4. System prompts, learns the tools
   5. Attempts to solve the problem using its tools

Async Tool Calling: primarily for research, or for triggering multiple other tools that each call agents

- Call tool. It returns an id for the job.
  - Code version: Agent is pinged with a "job complete" prompt, passing the job id (happens via the job finishing). The agent then can retrieve the job results.
  - MCP version: Agent has a tool where it can request jobs finished

Contexts:

- id
- text data
- created
- updated

Conversation Space

- Public space

Crew framework:

- You talk to the project manager
- Architect
- Developer
- Researcher
- Project manager

Meta Crew

- ## Observer
- Pruner
  - Looks at contexts, removes them that are stale

Each crew member:

- Can be spun up as needed in a job queue
- Knows all the goals/tasks up the tree from what they are doing
- Is listening to the public message bus
- Can see what other agents are working on
- Can wait indefinitely for other crew members to finish their tasks before finishing
- Can delegate tasks to more qualified members
- Can check in on delated tasks to see their progress
- Can post updates to task progress
- Has short term memory which is always loaded into context (a log of its own recent actions, notifications, etc)
- Is active or not
- Delegating is just an async tool call
- Researching is an async tool call

Each Task

- Is cursor or not (if it's cursor, it's not enqueued, and relies on a persistent agent to pick it up when it becomes available)
- Is owned by a crew member
- Has logs on it with progress tracked
- Is parented to another task
- Has its own context (raw text for now)
- Has a "cursor instruction" if relevant (cursor needs different instructions compared to agent)
- Has subscribers: all the agents who are immediately notified upon completion

Async Tools via Jobs

1. Agent makes a job tool request .enqueue(toolName, args, agentId, path)

Requests to agent:

- Via chat on web
- agent/[agentId]/webhook/[path] for finished jobs or just agent/[agentId]/webhook if no path specified.
  - Webhook hit with agent id and job data in body
  - Will prompt agent with: "Job [id] returned with data: { }"

# Supabase Authentication Implementation Plan

## 1. Setup and Configuration

- Install required packages
  ```bash
  pnpm add @supabase/supabase-js @supabase/ssr
  ```
- Configure environment variables
  - Create `.env.local` file with Supabase URL and anon key
  - Add these to `.gitignore` if not already there

## 2. Client Creation Utilities

- Create utility functions for Supabase clients
  - Create `utils/supabase/client.ts` for browser client
  - Create `utils/supabase/server.ts` for server-side client
  - Create `utils/supabase/middleware.ts` for auth middleware helpers

## 3. Middleware Setup

- Create `middleware.ts` at the project root
  - Implement session refreshing logic
  - Add appropriate matchers to exclude static assets
  - Configure to update auth tokens automatically

## 4. Authentication UI and Routes

- Create login page (`app/login/page.tsx`)
  - Implement email/password login form
  - Add server actions for login/signup (`app/login/actions.ts`)
- Create signup page or component
  - Implement registration form
  - Handle form submission via server actions
- Create logout functionality
  - Implement server action for logging out

## 5. Email Confirmation Flow

- Update Supabase email templates in the dashboard
  - Change confirmation URL format to support server-side flow
- Create confirmation handler
  - Implement `app/auth/confirm/route.ts` to handle email confirmations
  - Set up token verification and redirection

## 6. Protected Routes

- Create authentication checking utilities
  - Add helper for checking auth status in server components
- Implement protected routes
  - Create example private page (`app/private/page.tsx`)
  - Add authentication checks and redirects

## 7. User Profile Management

- Create user profile page
  - Display user information
  - Allow editing profile details
- Implement password reset functionality
  - Create forgot password page
  - Set up email templates for password reset

## 8. Testing and Validation

- Test authentication flows
  - Registration
  - Login
  - Email confirmation
  - Password reset
  - Protected routes
- Verify session persistence
  - Test session refresh functionality
  - Verify token refresh in middleware

## 9. Additional Features (Optional)

- Social login integration
  - Google, GitHub, etc.
- Multi-factor authentication
  - SMS or TOTP setup
- User role management
  - Admin vs regular users
  - Role-based access control

## 10. Deployment Considerations

- Ensure environment variables are set in production
- Configure Supabase production settings
- Test auth flows in staging/production environments
