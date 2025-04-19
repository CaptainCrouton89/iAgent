-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to the short_term_memory table
-- Assuming 1536 dimensions for OpenAI embeddings (adjust if using a different model)
ALTER TABLE public.short_term_memory ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create an index for faster similarity searches
CREATE INDEX IF NOT EXISTS short_term_memory_embedding_idx ON public.short_term_memory 
USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- Create a function to search memories by similarity
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  source text,
  source_id text,
  relevance_score numeric,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    content,
    source,
    source_id,
    relevance_score,
    created_at,
    1 - (embedding <=> query_embedding) AS similarity
  FROM short_term_memory
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding ASC
  LIMIT match_count;
$$; 