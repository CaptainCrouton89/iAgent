-- Enable Row Level Security
ALTER TABLE IF EXISTS public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.memory_cluster_map ENABLE ROW LEVEL SECURITY;

-- Create policies for memories table
CREATE POLICY "Users can insert their own memories" ON public.memories
  FOR INSERT 
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "Users can select their own memories" ON public.memories
  FOR SELECT 
  USING (auth_id = auth.uid());

CREATE POLICY "Users can update their own memories" ON public.memories
  FOR UPDATE 
  USING (auth_id = auth.uid());

CREATE POLICY "Users can delete their own memories" ON public.memories
  FOR DELETE 
  USING (auth_id = auth.uid());

-- Create policies for clusters table
CREATE POLICY "Users can insert their own clusters" ON public.clusters
  FOR INSERT 
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "Users can select their own clusters" ON public.clusters
  FOR SELECT 
  USING (auth_id = auth.uid());

CREATE POLICY "Users can update their own clusters" ON public.clusters
  FOR UPDATE 
  USING (auth_id = auth.uid());

CREATE POLICY "Users can delete their own clusters" ON public.clusters
  FOR DELETE 
  USING (auth_id = auth.uid());

-- Create policies for memory_cluster_map table
CREATE POLICY "Users can insert their own memory_cluster_map entries" ON public.memory_cluster_map
  FOR INSERT 
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "Users can select their own memory_cluster_map entries" ON public.memory_cluster_map
  FOR SELECT 
  USING (auth_id = auth.uid());

CREATE POLICY "Users can update their own memory_cluster_map entries" ON public.memory_cluster_map
  FOR UPDATE 
  USING (auth_id = auth.uid());

CREATE POLICY "Users can delete their own memory_cluster_map entries" ON public.memory_cluster_map
  FOR DELETE 
  USING (auth_id = auth.uid()); 