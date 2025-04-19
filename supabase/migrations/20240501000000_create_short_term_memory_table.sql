-- Create short_term_memory table
CREATE TABLE IF NOT EXISTS public.short_term_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    source TEXT NOT NULL, -- 'email', 'chat', etc.
    source_id TEXT, -- optional reference to the original content
    relevance_score NUMERIC(3,2) NOT NULL, -- Score between 0 and 1
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add RLS policies
ALTER TABLE public.short_term_memory ENABLE ROW LEVEL SECURITY;

-- Add function to automatically expire memories (optional)
CREATE OR REPLACE FUNCTION delete_old_memories()
RETURNS void AS $$
BEGIN
  DELETE FROM public.short_term_memory
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql; 