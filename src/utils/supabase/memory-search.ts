import { createClient } from "@/utils/supabase/server";
import { Message } from "@ai-sdk/react";
import OpenAI from "openai";

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MemorySearchResult {
  id: string;
  content: Message[]; // This will be the full message array in JSON format
  context: string | null;
  created_at: string;
  similarity: number;
}

/**
 * Search for memories using vector similarity
 * @param query The search query
 * @param threshold Similarity threshold (0-1)
 * @param limit Maximum number of results to return
 * @returns Array of memories with similarity scores
 */
export async function searchMemories(
  query: string,
  threshold: number = 0.5,
  limit: number = 5
): Promise<MemorySearchResult[]> {
  try {
    const supabase = await createClient();

    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Search for similar memories using the RPC function
    const { data, error } = await supabase.rpc("search_memories", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error("Error searching memories:", error);
      throw error;
    }

    return data as MemorySearchResult[];
  } catch (error) {
    console.error("Error in searchMemories:", error);
    throw error;
  }
}
