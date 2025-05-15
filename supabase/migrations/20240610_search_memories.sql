-- Create a function to search memories by embedding similarity
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content jsonb,
  context text,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    content,
    context,
    created_at,
    1 - (embedding <=> query_embedding) AS similarity
  FROM memories
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  AND embedding IS NOT NULL
  ORDER BY similarity DESC
  LIMIT match_count;
$$; 