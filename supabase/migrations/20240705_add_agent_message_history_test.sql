-- Test the agent_message_history table by inserting and querying data

-- First, let's make sure we have at least one agent for testing
DO $$
DECLARE
  agent_id UUID;
BEGIN
  -- Check if we have an agent already
  SELECT id INTO agent_id FROM agents LIMIT 1;
  
  -- If not, create one
  IF agent_id IS NULL THEN
    INSERT INTO agents (title, goal, agent_type) 
    VALUES ('Test Agent', 'Testing message history', 'general')
    RETURNING id INTO agent_id;
  END IF;
  
  -- Insert test messages
  INSERT INTO agent_message_history (agent_id, role, content, metadata)
  VALUES 
    (agent_id, 'user', 'Hello, can you help me with a task?', '{"source": "test"}'::jsonb),
    (agent_id, 'assistant', 'Of course! What can I help you with?', '{"source": "test"}'::jsonb),
    (agent_id, 'user', 'I need help creating a migration file.', '{"source": "test"}'::jsonb);
    
  -- Verify the data was inserted correctly
  ASSERT (SELECT COUNT(*) FROM agent_message_history WHERE agent_id = agent_id) = 3, 
    'Expected 3 messages for the agent';
    
  -- Clean up test data
  DELETE FROM agent_message_history WHERE metadata->>'source' = 'test';
END $$; 