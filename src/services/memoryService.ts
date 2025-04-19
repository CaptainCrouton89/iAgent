import { Database } from "../../supabase/database.types";
import { AIService } from "./aiService";
import { SupabaseService } from "./supabaseService";

export interface Memory {
  id?: string;
  content: string;
  source: string;
  source_id?: string;
  relevance_score: number;
  created_at?: string;
  embedding?: number[];
  similarity?: number;
}

type DatabaseMemory = Database["public"]["Tables"]["short_term_memory"]["Row"];

export class MemoryService {
  private supabaseService: SupabaseService;
  private aiService?: AIService;

  constructor(supabaseService: SupabaseService, aiService?: AIService) {
    this.supabaseService = supabaseService;
    this.aiService = aiService;
  }

  /**
   * Set the AI service instance
   */
  setAIService(aiService: AIService): void {
    this.aiService = aiService;
  }

  /**
   * Create a new memory entry
   * Processes the raw memory text through AI to create a first-person summarized memory
   */
  async createMemory(memory: Memory): Promise<Memory> {
    try {
      const supabase = this.supabaseService.getClient();

      // Process the memory content through AI if available
      let processedContent = memory.content;
      if (this.aiService) {
        try {
          processedContent = await this.aiService.processMemoryContent({
            content: memory.content,
            source: memory.source,
          });
          console.log("Memory processed through AI service");
        } catch (error) {
          console.error("Error processing memory through AI:", error);
          // Continue with original content if processing fails
        }
      }

      const { data, error } = await supabase
        .from("short_term_memory")
        .insert({
          content: processedContent,
          source: memory.source,
          source_id: memory.source_id || null,
          relevance_score: memory.relevance_score,
          created_at: new Date().toISOString(),
          embedding: memory.embedding ? JSON.stringify(memory.embedding) : null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating memory:", error);
        throw error;
      }

      return this.mapDatabaseMemoryToMemory(data);
    } catch (error) {
      console.error("Error creating memory:", error);
      throw error;
    }
  }

  /**
   * Get all memories, optionally filtered by date range or source
   */
  async getMemories(options?: {
    fromDate?: Date;
    toDate?: Date;
    source?: string;
    limit?: number;
  }): Promise<Memory[]> {
    try {
      const supabase = this.supabaseService.getClient();

      let query = supabase
        .from("short_term_memory")
        .select("*")
        .order("created_at", { ascending: false });

      // Apply filters if provided
      if (options?.fromDate) {
        query = query.gte("created_at", options.fromDate.toISOString());
      }

      if (options?.toDate) {
        query = query.lte("created_at", options.toDate.toISOString());
      }

      if (options?.source) {
        query = query.eq("source", options.source);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching memories:", error);
        throw error;
      }

      return data.map(this.mapDatabaseMemoryToMemory);
    } catch (error) {
      console.error("Error fetching memories:", error);
      throw error;
    }
  }

  /**
   * Get a memory by ID
   */
  async getMemoryById(id: string): Promise<Memory | null> {
    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from("short_term_memory")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Record not found
          return null;
        }
        console.error("Error fetching memory:", error);
        throw error;
      }

      return this.mapDatabaseMemoryToMemory(data);
    } catch (error) {
      console.error("Error fetching memory:", error);
      throw error;
    }
  }

  /**
   * Find similar memories using vector similarity search
   */
  async findSimilarMemories(
    embedding: number[],
    options?: {
      matchThreshold?: number;
      limit?: number;
    }
  ): Promise<Memory[]> {
    try {
      const supabase = this.supabaseService.getClient();

      // Convert the embedding array to a string for the RPC call
      const { data, error } = await supabase.rpc("match_memories", {
        query_embedding: JSON.stringify(embedding),
        match_threshold: options?.matchThreshold || 0.7,
        match_count: options?.limit || 10,
      });

      if (error) {
        console.error("Error finding similar memories:", error);
        throw error;
      }

      return data.map((item) => ({
        id: item.id,
        content: item.content,
        source: item.source,
        source_id: item.source_id || undefined,
        relevance_score: item.relevance_score,
        created_at: item.created_at,
        similarity: item.similarity,
      }));
    } catch (error) {
      console.error("Error finding similar memories:", error);
      throw error;
    }
  }

  /**
   * Delete a memory by ID
   */
  async deleteMemory(id: string): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();

      const { error } = await supabase
        .from("short_term_memory")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting memory:", error);
        throw error;
      }
    } catch (error) {
      console.error("Error deleting memory:", error);
      throw error;
    }
  }

  /**
   * Delete old memories (older than specified days)
   */
  async deleteOldMemories(olderThanDays: number = 30): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();

      // Calculate the cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { error } = await supabase
        .from("short_term_memory")
        .delete()
        .lt("created_at", cutoffDate.toISOString());

      if (error) {
        console.error("Error deleting old memories:", error);
        throw error;
      }
    } catch (error) {
      console.error("Error deleting old memories:", error);
      throw error;
    }
  }

  /**
   * Helper method to convert database memory to Memory interface
   */
  private mapDatabaseMemoryToMemory(data: DatabaseMemory): Memory {
    // Parse embedding from string to number[] if it exists
    let embeddingArray: number[] | undefined = undefined;
    if (data.embedding) {
      try {
        embeddingArray = JSON.parse(data.embedding);
      } catch (e) {
        console.error("Error parsing embedding:", e);
      }
    }

    return {
      id: data.id,
      content: data.content,
      source: data.source,
      source_id: data.source_id || undefined,
      relevance_score: data.relevance_score,
      created_at: data.created_at,
      embedding: embeddingArray,
    };
  }
}
