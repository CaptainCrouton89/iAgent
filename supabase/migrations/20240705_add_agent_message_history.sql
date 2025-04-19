-- Create agent_message_history table
CREATE TABLE agent_message_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add trigger to update the updated_at column
CREATE TRIGGER update_agent_message_history_updated_at
BEFORE UPDATE ON agent_message_history
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Add indexes for query performance
CREATE INDEX idx_agent_message_history_agent_id ON agent_message_history(agent_id);
CREATE INDEX idx_agent_message_history_created_at ON agent_message_history(created_at);

-- Add RLS policies for the agent_message_history table
ALTER TABLE agent_message_history ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust as needed based on your security requirements)
CREATE POLICY "Allow all operations for authenticated users" ON agent_message_history
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true); 