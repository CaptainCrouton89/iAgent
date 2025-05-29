import { createClient } from "@/utils/supabase/server";
import { Message } from "@ai-sdk/react";
import OpenAI from "openai";

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Label importance multipliers for scoring
const LABEL_MULTIPLIERS: Record<string, number> = {
  important: 1.5,
  user_profile: 1.3,
  general: 1.0,
  temporary: 0.8,
  trivial: 0.5,
};

// Calculate recency score based on exponential decay
function calculateRecencyScore(lastUsed: string | undefined): number {
  if (!lastUsed) return 0.5; // Default score if no last_used date

  const now = new Date();
  const lastUsedDate = new Date(lastUsed);
  const daysSinceUsed =
    (now.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24);

  // Exponential decay with 30-day half-life
  return Math.exp(-daysSinceUsed / 30);
}

// Calculate composite score for memory ranking
function calculateCompositeScore(memory: MemorySearchResult): number {
  const similarity = memory.similarity || 0;
  const strength = memory.strength || 0.5;
  const recencyScore = calculateRecencyScore(memory.last_used);

  // Get label multiplier
  const labelMultiplier = memory.label
    ? LABEL_MULTIPLIERS[memory.label] || 1.0
    : 1.0;

  // Base composite score
  let score =
    similarity * 0.4 +
    strength * 0.3 +
    recencyScore * 0.2 +
    labelMultiplier * 0.1;

  // Apply pinned bonus
  if (memory.pinned) {
    score += 1.0;
  }

  return score;
}

// Enrich search results with metadata fields
async function enrichMemoriesWithMetadata(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memories: MemorySearchResult[]
): Promise<MemorySearchResult[]> {
  if (memories.length === 0) return memories;

  // Get IDs of all memories
  const memoryIds = memories.map((m) => m.id);

  // Fetch metadata for all memories
  const { data: metadataResults, error } = await supabase
    .from("memories")
    .select("id, title, summary, label, strength, last_used, pinned")
    .in("id", memoryIds);

  if (error) {
    console.error("Error fetching memory metadata:", error);
    return memories; // Return original memories if metadata fetch fails
  }

  // Create a map for quick lookup
  const metadataMap = new Map(metadataResults?.map((m) => [m.id, m]) || []);

  // Merge metadata into memories
  return memories.map((memory) => {
    const metadata = metadataMap.get(memory.id);
    if (metadata) {
      return {
        ...memory,
        title: metadata.title || memory.title,
        summary: metadata.summary || memory.summary,
        label: metadata.label,
        strength: metadata.strength,
        last_used: metadata.last_used,
        pinned: metadata.pinned,
      };
    }
    return memory;
  });
}

export interface MemorySearchResult {
  id: string;
  content: Message[]; // This will be the full message array in JSON format
  compressed_conversation: { role: string; content: string }[] | null;
  context: string | null;
  title: string | null;
  summary: string | null;
  created_at: string;
  similarity: number;
  // Additional metadata fields for enhanced ranking
  label?: string | null;
  strength?: number;
  last_used?: string;
  pinned?: boolean;
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

    // Fetch 3x the requested limit to allow for better ranking
    const fetchMultiplier = 3;
    const expandedLimit = limit * fetchMultiplier;

    // If query is empty and we have date filters, just get memories by date
    if (!query && (startDate || endDate)) {
      // First get total count
      const { count } = await supabase
        .from("memories")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startDate?.toISOString() || "1970-01-01")
        .lte("created_at", endDate?.toISOString() || new Date().toISOString());

      const totalCount = count || 0;

      // Then get paginated results with all metadata fields
      const { data, error } = await supabase
        .from("memories")
        .select(
          "id, content, compressed_conversation, context, title, summary, created_at, label, strength, last_used, pinned"
        )
        .gte("created_at", startDate?.toISOString() || "1970-01-01")
        .lte("created_at", endDate?.toISOString() || new Date().toISOString())
        .order("created_at", { ascending: false })
        .range(0, expandedLimit - 1);

      if (error) {
        console.error("Error fetching memories by date:", error);
        throw error;
      }

      // Add similarity score of 1.0 for date-only searches
      let memories = (data || []).map((memory) => ({
        ...memory,
        similarity: 1.0,
      })) as MemorySearchResult[];

      // Apply enhanced ranking
      memories = memories
        .map((memory) => ({
          ...memory,
          compositeScore: calculateCompositeScore(memory),
        }))
        .sort((a, b) => b.compositeScore - a.compositeScore)
        .slice(offset, offset + limit);

      return {
        memories,
        totalCount,
        page,
        pageSize: limit,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + limit < totalCount,
      };
    }

    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query || "general conversation",
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Fetch more results than requested for better ranking
    const fetchLimit = Math.min(expandedLimit * page, 100); // Cap at 100 for performance

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

        let allMemories = fallbackData as MemorySearchResult[];

        // Enrich with metadata and apply enhanced ranking
        allMemories = await enrichMemoriesWithMetadata(supabase, allMemories);
        allMemories = allMemories
          .map((memory) => ({
            ...memory,
            compositeScore: calculateCompositeScore(memory),
          }))
          .sort((a, b) => b.compositeScore - a.compositeScore);

        const paginatedMemories = allMemories.slice(offset, offset + limit);

        return {
          memories: paginatedMemories,
          totalCount: allMemories.length,
          page,
          pageSize: limit,
          totalPages: Math.ceil(allMemories.length / limit),
          hasMore: offset + limit < allMemories.length,
        };
      }

      let allMemories = data as MemorySearchResult[];

      // Enrich with metadata and apply enhanced ranking
      allMemories = await enrichMemoriesWithMetadata(supabase, allMemories);
      allMemories = allMemories
        .map((memory) => ({
          ...memory,
          compositeScore: calculateCompositeScore(memory),
        }))
        .sort((a, b) => b.compositeScore - a.compositeScore);

      const paginatedMemories = allMemories.slice(offset, offset + limit);

      return {
        memories: paginatedMemories,
        totalCount: allMemories.length,
        page,
        pageSize: limit,
        totalPages: Math.ceil(allMemories.length / limit),
        hasMore: offset + limit < allMemories.length,
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

      let allMemories = data as MemorySearchResult[];

      // Enrich with metadata and apply enhanced ranking
      allMemories = await enrichMemoriesWithMetadata(supabase, allMemories);
      allMemories = allMemories
        .map((memory) => ({
          ...memory,
          compositeScore: calculateCompositeScore(memory),
        }))
        .sort((a, b) => b.compositeScore - a.compositeScore);

      const paginatedMemories = allMemories.slice(offset, offset + limit);

      return {
        memories: paginatedMemories,
        totalCount: allMemories.length,
        page,
        pageSize: limit,
        totalPages: Math.ceil(allMemories.length / limit),
        hasMore: offset + limit < allMemories.length,
      };
    }
  } catch (error) {
    console.error("Error in searchMemories:", error);
    throw error;
  }
}
