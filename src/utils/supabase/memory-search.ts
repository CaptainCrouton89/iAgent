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
  compressed_conversation: { role: string; content: string }[] | null;
  context: string | null;
  title: string | null;
  summary: string | null;
  created_at: string;
  similarity: number;
}

export interface PaginatedMemorySearchResult {
  memories: MemorySearchResult[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Search for memories using vector similarity
 * @param query The search query
 * @param threshold Similarity threshold (0-1)
 * @param limit Maximum number of results to return
 * @param startDate Optional start date for filtering
 * @param endDate Optional end date for filtering
 * @param page Page number (1-based)
 * @returns Paginated memories with similarity scores
 */
export async function searchMemories(
  query: string,
  threshold: number = 0.5,
  limit: number = 5,
  startDate?: Date,
  endDate?: Date,
  page: number = 1
): Promise<PaginatedMemorySearchResult> {
  try {
    const supabase = await createClient();
    const offset = (page - 1) * limit;

    // If query is empty and we have date filters, just get memories by date
    if (!query && (startDate || endDate)) {
      // First get total count
      const { count } = await supabase
        .from("memories")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startDate?.toISOString() || "1970-01-01")
        .lte("created_at", endDate?.toISOString() || new Date().toISOString());

      const totalCount = count || 0;

      // Then get paginated results
      const { data, error } = await supabase
        .from("memories")
        .select("id, content, compressed_conversation, context, title, summary, created_at")
        .gte("created_at", startDate?.toISOString() || "1970-01-01")
        .lte("created_at", endDate?.toISOString() || new Date().toISOString())
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("Error fetching memories by date:", error);
        throw error;
      }

      // Add similarity score of 1.0 for date-only searches
      const memories = (data || []).map((memory) => ({
        ...memory,
        similarity: 1.0,
      })) as MemorySearchResult[];

      return {
        memories,
        totalCount,
        page,
        pageSize: limit,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + limit < totalCount
      };
    }

    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query || "general conversation",
    });

    const embedding = embeddingResponse.data[0].embedding;

    // For paginated results, we need to fetch more than requested and slice
    // This is because the RPC functions don't support OFFSET
    const fetchLimit = limit * page; // Fetch all results up to current page

    // Search for similar memories using the RPC function
    // If date filters are provided, use the date-aware function
    if (startDate || endDate) {
      const { data, error } = await supabase.rpc("search_memories_by_date", {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: fetchLimit,
        start_date: startDate?.toISOString() || null,
        end_date: endDate?.toISOString() || null,
      });

      if (error) {
        console.error("Error searching memories by date:", error);
        // Fallback to regular search if date search fails
        const { data: fallbackData, error: fallbackError } = await supabase.rpc(
          "search_memories",
          {
            query_embedding: embedding,
            match_threshold: threshold,
            match_count: fetchLimit,
          }
        );

        if (fallbackError) {
          console.error("Error in fallback search:", fallbackError);
          throw fallbackError;
        }

        const allMemories = fallbackData as MemorySearchResult[];
        const paginatedMemories = allMemories.slice(offset, offset + limit);
        
        return {
          memories: paginatedMemories,
          totalCount: allMemories.length,
          page,
          pageSize: limit,
          totalPages: Math.ceil(allMemories.length / limit),
          hasMore: offset + limit < allMemories.length
        };
      }

      const allMemories = data as MemorySearchResult[];
      const paginatedMemories = allMemories.slice(offset, offset + limit);
      
      return {
        memories: paginatedMemories,
        totalCount: allMemories.length,
        page,
        pageSize: limit,
        totalPages: Math.ceil(allMemories.length / limit),
        hasMore: offset + limit < allMemories.length
      };
    } else {
      // Use regular search without date filtering
      const { data, error } = await supabase.rpc("search_memories", {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: fetchLimit,
      });

      if (error) {
        console.error("Error searching memories:", error);
        throw error;
      }

      const allMemories = data as MemorySearchResult[];
      const paginatedMemories = allMemories.slice(offset, offset + limit);
      
      return {
        memories: paginatedMemories,
        totalCount: allMemories.length,
        page,
        pageSize: limit,
        totalPages: Math.ceil(allMemories.length / limit),
        hasMore: offset + limit < allMemories.length
      };
    }
  } catch (error) {
    console.error("Error in searchMemories:", error);
    throw error;
  }
}
