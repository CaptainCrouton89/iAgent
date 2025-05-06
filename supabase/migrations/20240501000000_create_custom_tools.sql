-- Create custom tools tables
-- This migration creates tables for storing and managing custom tools with RLS

-- Custom Tools table
CREATE TABLE public.custom_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Tool metadata
  input_schema JSONB NOT NULL DEFAULT '{}'::JSONB, -- Zod schema structure 
  is_async BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- UNIQUE constraint to prevent duplicate tool names per user
  UNIQUE (owner, name)
);

-- Custom Tool Implementations
CREATE TABLE public.custom_tool_implementations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES public.custom_tools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Actual code implementations
  execute_code TEXT NOT NULL, -- Code for execute method
  sync_tool_code TEXT, -- Code for synchronous tool (optional for async tools)
  
  -- Current version flag
  is_current_version BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1
);

-- Tool execution history
CREATE TABLE public.custom_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES public.custom_tools(id) ON DELETE CASCADE,
  implementation_id UUID NOT NULL REFERENCES public.custom_tool_implementations(id) ON DELETE CASCADE,
  agent_id UUID, -- Can be null if executed directly
  input_args JSONB NOT NULL DEFAULT '{}'::JSONB,
  output_result JSONB,
  success BOOLEAN,
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add RLS policies

-- Enable RLS on all tables
ALTER TABLE public.custom_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_tool_implementations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_tool_executions ENABLE ROW LEVEL SECURITY;

-- Create policies for custom_tools table
CREATE POLICY "Users can create their own tools" 
  ON public.custom_tools FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = owner);

CREATE POLICY "Users can view their own tools" 
  ON public.custom_tools FOR SELECT 
  TO authenticated 
  USING (auth.uid() = owner);

CREATE POLICY "Users can update their own tools" 
  ON public.custom_tools FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = owner) 
  WITH CHECK (auth.uid() = owner);

CREATE POLICY "Users can delete their own tools" 
  ON public.custom_tools FOR DELETE 
  TO authenticated 
  USING (auth.uid() = owner);

-- Create policies for custom_tool_implementations table
CREATE POLICY "Users can create implementations for their own tools" 
  ON public.custom_tool_implementations FOR INSERT 
  TO authenticated 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.custom_tools 
    WHERE id = tool_id AND owner = auth.uid()
  ));

CREATE POLICY "Users can view implementations of their own tools" 
  ON public.custom_tool_implementations FOR SELECT 
  TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM public.custom_tools 
    WHERE id = tool_id AND owner = auth.uid()
  ));

CREATE POLICY "Users can update implementations of their own tools" 
  ON public.custom_tool_implementations FOR UPDATE 
  TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM public.custom_tools 
    WHERE id = tool_id AND owner = auth.uid()
  ));

CREATE POLICY "Users can delete implementations of their own tools" 
  ON public.custom_tool_implementations FOR DELETE 
  TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM public.custom_tools 
    WHERE id = tool_id AND owner = auth.uid()
  ));

-- Create policies for custom_tool_executions table
CREATE POLICY "Users can view executions of their own tools" 
  ON public.custom_tool_executions FOR SELECT 
  TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM public.custom_tools 
    WHERE id = tool_id AND owner = auth.uid()
  ));

-- Add triggers to handle versioning
CREATE OR REPLACE FUNCTION update_previous_tool_versions()
RETURNS TRIGGER AS $$
BEGIN
  -- Set is_current_version to false for all other versions of this tool
  UPDATE public.custom_tool_implementations
  SET is_current_version = false
  WHERE tool_id = NEW.tool_id 
    AND id != NEW.id;
  
  -- Set the version number
  IF NEW.version = 1 THEN
    -- For first version, keep as is
    NULL;
  ELSE
    -- For subsequent versions, increment
    NEW.version := (
      SELECT COALESCE(MAX(version), 0) + 1
      FROM public.custom_tool_implementations
      WHERE tool_id = NEW.tool_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_tool_implementation
BEFORE INSERT ON public.custom_tool_implementations
FOR EACH ROW EXECUTE FUNCTION update_previous_tool_versions();

-- Add function to update timestamps
CREATE OR REPLACE FUNCTION update_modified_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_custom_tools_timestamp
BEFORE UPDATE ON public.custom_tools
FOR EACH ROW EXECUTE FUNCTION update_modified_timestamp();

CREATE TRIGGER update_custom_tool_implementations_timestamp
BEFORE UPDATE ON public.custom_tool_implementations
FOR EACH ROW EXECUTE FUNCTION update_modified_timestamp();

-- Create a view to get the current implementation version for each tool
CREATE VIEW public.current_tool_implementations AS
SELECT t.id as tool_id, 
       t.name as tool_name, 
       t.owner,
       t.description,
       t.input_schema,
       t.is_async,
       t.is_active,
       i.id as implementation_id,
       i.execute_code,
       i.sync_tool_code,
       i.version
FROM public.custom_tools t
JOIN public.custom_tool_implementations i ON t.id = i.tool_id
WHERE i.is_current_version = true;

-- Add RLS to the view
ALTER VIEW public.current_tool_implementations SECURITY INVOKER;

-- Create a policy to ensure only owners can see their tools in the view
CREATE POLICY "Users can only view their own tool implementations" 
  ON public.current_tool_implementations FOR SELECT 
  TO authenticated 
  USING (owner = auth.uid()); 