-- Create semantic memories table
CREATE TABLE IF NOT EXISTS public.semantic_memories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('fact', 'theme', 'summary')),
    content text NOT NULL,
    embedding vector(1536),
    confidence numeric DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    strength numeric DEFAULT 1.0 CHECK (strength >= 0 AND strength <= 1),
    provenance jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of {episode_id: uuid, timestamp: timestamp}
    related_memories uuid[] DEFAULT ARRAY[]::uuid[], -- Array of semantic memory IDs
    last_updated timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_semantic_memories_auth_id ON public.semantic_memories(auth_id);
CREATE INDEX idx_semantic_memories_type ON public.semantic_memories(type);
CREATE INDEX idx_semantic_memories_embedding ON public.semantic_memories USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_semantic_memories_content_gin ON public.semantic_memories USING gin (to_tsvector('english', content));
CREATE INDEX idx_semantic_memories_confidence ON public.semantic_memories(confidence);
CREATE INDEX idx_semantic_memories_strength ON public.semantic_memories(strength);

-- Enable RLS
ALTER TABLE public.semantic_memories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own semantic memories"
ON public.semantic_memories FOR SELECT
USING (auth.uid() = auth_id);

CREATE POLICY "Users can insert their own semantic memories"
ON public.semantic_memories FOR INSERT
WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "Users can update their own semantic memories"
ON public.semantic_memories FOR UPDATE
USING (auth.uid() = auth_id);

CREATE POLICY "Users can delete their own semantic memories"
ON public.semantic_memories FOR DELETE
USING (auth.uid() = auth_id);

-- Function to search semantic memories by similarity
CREATE OR REPLACE FUNCTION search_semantic_memories(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    filter_type text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    type text,
    content text,
    confidence numeric,
    strength numeric,
    provenance jsonb,
    related_memories uuid[],
    created_at timestamp with time zone,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sm.id,
        sm.type,
        sm.content,
        sm.confidence,
        sm.strength,
        sm.provenance,
        sm.related_memories,
        sm.created_at,
        1 - (sm.embedding <=> query_embedding) as similarity
    FROM semantic_memories sm
    WHERE 
        sm.auth_id = auth.uid()
        AND (filter_type IS NULL OR sm.type = filter_type)
        AND 1 - (sm.embedding <=> query_embedding) > match_threshold
    ORDER BY sm.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to merge or update semantic memory
CREATE OR REPLACE FUNCTION upsert_semantic_memory(
    p_auth_id uuid,
    p_type text,
    p_content text,
    p_embedding vector(1536),
    p_confidence numeric,
    p_provenance jsonb,
    p_similarity_threshold float DEFAULT 0.85
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    existing_id uuid;
    existing_confidence numeric;
    existing_provenance jsonb;
    new_id uuid;
BEGIN
    -- Check for existing similar semantic memory
    SELECT id, confidence, provenance INTO existing_id, existing_confidence, existing_provenance
    FROM semantic_memories
    WHERE 
        auth_id = p_auth_id 
        AND type = p_type
        AND 1 - (embedding <=> p_embedding) > p_similarity_threshold
    ORDER BY embedding <=> p_embedding
    LIMIT 1;
    
    IF existing_id IS NOT NULL THEN
        -- Update existing memory
        UPDATE semantic_memories
        SET 
            confidence = LEAST(1.0, existing_confidence + 0.1), -- Increase confidence
            provenance = existing_provenance || p_provenance, -- Append new provenance
            last_updated = now(),
            strength = LEAST(1.0, strength + 0.1) -- Reinforce strength
        WHERE id = existing_id;
        
        RETURN existing_id;
    ELSE
        -- Insert new semantic memory
        INSERT INTO semantic_memories (
            auth_id,
            type,
            content,
            embedding,
            confidence,
            provenance
        ) VALUES (
            p_auth_id,
            p_type,
            p_content,
            p_embedding,
            p_confidence,
            p_provenance
        )
        RETURNING id INTO new_id;
        
        RETURN new_id;
    END IF;
END;
$$;

-- Function to decay semantic memories (similar to episodic memory decay)
CREATE OR REPLACE FUNCTION decay_semantic_memories()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Decay strength of semantic memories not updated recently
    UPDATE semantic_memories
    SET strength = GREATEST(0, strength - 0.05)
    WHERE 
        last_updated < now() - interval '30 days'
        AND strength > 0;
    
    -- Remove semantic memories with very low strength and confidence
    DELETE FROM semantic_memories
    WHERE strength < 0.1 AND confidence < 0.3;
END;
$$;

-- Add trigger to update related_memories when semantic memories are deleted
CREATE OR REPLACE FUNCTION update_related_memories()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Remove the deleted memory ID from all related_memories arrays
    UPDATE semantic_memories
    SET related_memories = array_remove(related_memories, OLD.id)
    WHERE OLD.id = ANY(related_memories);
    
    RETURN OLD;
END;
$$;

CREATE TRIGGER semantic_memory_cleanup
BEFORE DELETE ON semantic_memories
FOR EACH ROW
EXECUTE FUNCTION update_related_memories();