-- Enable Row Level Security
ALTER TABLE contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE programming_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
-- Contexts policies
CREATE POLICY "Authenticated users can read contexts"
  ON contexts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert contexts"
  ON contexts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their contexts"
  ON contexts FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Agents policies
CREATE POLICY "Authenticated users can read agents"
  ON agents FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert agents"
  ON agents FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their agents"
  ON agents FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Tasks policies
CREATE POLICY "Authenticated users can read tasks"
  ON tasks FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their tasks"
  ON tasks FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Programming_tasks policies
CREATE POLICY "Authenticated users can read programming_tasks"
  ON programming_tasks FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert programming_tasks"
  ON programming_tasks FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their programming_tasks"
  ON programming_tasks FOR UPDATE
  USING (auth.role() = 'authenticated'); 