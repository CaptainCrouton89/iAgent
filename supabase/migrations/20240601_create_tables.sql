-- Create contexts table
CREATE TABLE contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create agents table
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  goal TEXT,
  background TEXT,
  context_id UUID REFERENCES contexts(id),
  is_active BOOLEAN DEFAULT TRUE,
  agent_type TEXT NOT NULL,
  logs TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done')),
  parent_id UUID REFERENCES tasks(id),
  owner_id UUID REFERENCES agents(id),
  context_id UUID REFERENCES contexts(id),
  is_cursor BOOLEAN DEFAULT FALSE,
  logs TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create programming_tasks table
CREATE TABLE programming_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  description TEXT,
  context_id UUID REFERENCES contexts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add triggers to update the updated_at columns
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contexts_updated_at
BEFORE UPDATE ON contexts
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_agents_updated_at
BEFORE UPDATE ON agents
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_programming_tasks_updated_at
BEFORE UPDATE ON programming_tasks
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Add indexes for foreign keys to improve query performance
CREATE INDEX idx_agents_context_id ON agents(context_id);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_tasks_owner_id ON tasks(owner_id);
CREATE INDEX idx_tasks_context_id ON tasks(context_id);
CREATE INDEX idx_programming_tasks_task_id ON programming_tasks(task_id);
CREATE INDEX idx_programming_tasks_context_id ON programming_tasks(context_id); 