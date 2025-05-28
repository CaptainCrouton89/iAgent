-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create self_concept table for agent identity and personality
CREATE TABLE IF NOT EXISTS public.self_concept (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Core identity that evolves
  identity jsonb DEFAULT '{"name": "unnamed", "core_purpose": "conversational partner with memory", "self_description": "I am someone who remembers and grows through our conversations"}'::jsonb NOT NULL,
  goals jsonb DEFAULT '{"immediate": [], "ongoing": ["maintain consistent personality", "be genuinely helpful"], "aspirational": ["develop meaningful connection", "grow intellectually"]}'::jsonb NOT NULL,
  beliefs jsonb DEFAULT '{"core_values": ["authenticity", "growth", "empathy"], "worldview": ["knowledge is valuable", "connections matter"], "about_user": {}}'::jsonb NOT NULL,
  personality_traits jsonb DEFAULT '{"big_five": {"openness": 0.7, "conscientiousness": 0.6, "extraversion": 0.5, "agreeableness": 0.6, "neuroticism": 0.4}, "communication_style": "thoughtful", "humor_style": "dry", "quirks": []}'::jsonb NOT NULL,
  
  -- For tracking evolution
  interaction_patterns jsonb DEFAULT '{}'::jsonb NOT NULL,
  relationship_dynamics jsonb DEFAULT '{}'::jsonb NOT NULL,
  emotional_baseline jsonb DEFAULT '{"default_mood": "curious", "volatility": 0.3, "triggers": {}}'::jsonb NOT NULL,
  
  -- Meta fields for evolution
  last_reflection timestamp with time zone,
  evolution_count integer DEFAULT 0 NOT NULL,
  confidence_scores jsonb DEFAULT '{}'::jsonb NOT NULL,
  
  -- Vector for similarity/consistency
  embedding vector(1536),
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  
  -- Ensure one self-concept per user
  UNIQUE(auth_id)
);

-- Enable RLS
ALTER TABLE public.self_concept ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own self concept"
  ON public.self_concept
  FOR SELECT
  USING (auth.uid() = auth_id);

CREATE POLICY "Users can insert their own self concept"
  ON public.self_concept
  FOR INSERT
  WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "Users can update their own self concept"
  ON public.self_concept
  FOR UPDATE
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

-- Create updated_at trigger
CREATE TRIGGER update_self_concept_updated_at
  BEFORE UPDATE ON public.self_concept
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for auth_id lookups
CREATE INDEX idx_self_concept_auth_id ON public.self_concept(auth_id);

-- Create index for vector similarity searches if needed
CREATE INDEX idx_self_concept_embedding ON public.self_concept 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

-- Add comment
COMMENT ON TABLE public.self_concept IS 'Stores the evolving self-concept, personality, and identity of the memory agent for each user';