import { formatRelativeTime } from "@/utils/dateFormat";
import { searchMemories } from "@/utils/supabase/memory-search";
import { searchSemanticMemories } from "@/actions/semantic-memory";
import { ChatCompletionTool } from "openai/resources/chat/completions";
import { MemorySearchParameters } from "@/types/openai-chat";

export const memorySearchToolDefinition: ChatCompletionTool = {
  type: "function",
  function: {
    name: "searchMemories",
    description:
      "Search for memories using different modes: 'episodic' for specific conversations/events, 'semantic' for facts/themes/summaries, or 'hybrid' for both. Supports semantic similarity search, date filtering, and pagination.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The search query to find relevant memories (optional - leave empty to search all memories in date range)",
        },
        threshold: {
          type: "number",
          description: "Similarity threshold (.6-.9)",
          minimum: 0,
          maximum: 1,
          default: 0.7,
        },
        limit: {
          type: "number",
          description: "Maximum number of results per page",
          minimum: 1,
          maximum: 10,
        },
        memoryType: {
          type: "string",
          enum: ["episodic", "semantic", "hybrid"],
          description:
            "Memory type: 'episodic' for conversations/events, 'semantic' for facts/themes, 'hybrid' for both",
        },
        searchMode: {
          type: "string",
          enum: ["deep", "shallow"],
          description:
            "Search mode: 'deep' returns full content, 'shallow' returns only titles/summaries (episodic only)",
        },
        semanticType: {
          type: "string",
          enum: ["fact", "theme", "summary"],
          description:
            "Filter semantic memories by type (only applies when memoryType includes semantic)",
        },
        page: {
          type: "number",
          description: "Page number (1-based) for paginated results",
          minimum: 1,
          default: 1,
        },
        startDate: {
          type: "string",
          description:
            "Start date for search range (ISO format or relative like '7 days ago')",
        },
        endDate: {
          type: "string",
          description:
            "End date for search range (ISO format or relative like 'today')",
        },
        hypothesis: {
          type: "string",
          description:
            "Current hypothesis being tested - helps focus search for supporting or contradicting evidence",
        },
        evidenceType: {
          type: "string",
          enum: ["supporting", "contradicting", "neutral"],
          description:
            "Type of evidence being sought relative to current hypothesis",
        },
      },
      required: ["limit", "memoryType"],
    },
  },
};

export async function executeMemorySearch(params: MemorySearchParameters & { hypothesis?: string; evidenceType?: string; memoryType?: "episodic" | "semantic" | "hybrid"; semanticType?: "fact" | "theme" | "summary" }): Promise<string> {
  try {
    const {
      query,
      threshold = 0.7,
      limit = 10,
      page = 1,
      startDate,
      endDate,
      searchMode = "deep",
      memoryType = "hybrid",
      semanticType,
      hypothesis,
      evidenceType,
    } = params;

    // Parse relative dates if provided
    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;

    if (startDate) {
      parsedStartDate = parseRelativeDate(startDate);
    }

    if (endDate) {
      parsedEndDate = parseRelativeDate(endDate);
    }

    // Enhance search query with reasoning context
    let searchQuery = query || "";
    if (hypothesis && !query) {
      searchQuery = hypothesis;
    } else if (hypothesis && query) {
      searchQuery = `${query} ${hypothesis}`;
    }

    // Handle different memory types
    if (memoryType === "semantic") {
      // Search only semantic memories
      if (!searchQuery) {
        return "Query is required for semantic memory search.";
      }
      
      const semanticResults = await searchSemanticMemories(searchQuery, {
        type: semanticType,
        threshold,
        limit,
      });
      
      if (semanticResults.length === 0) {
        return "No relevant semantic memories found.";
      }
      
      const semanticOutput = semanticResults
        .map((memory: { id: string; type: string; content: string; similarity: number; confidence: number }, index: number) => {
          const typeLabel = memory.type.charAt(0).toUpperCase() + memory.type.slice(1);
          return `${typeLabel} ${index + 1} [ID: ${memory.id}] (Relevance: ${Math.round(
            memory.similarity * 100
          )}%, Confidence: ${Math.round(memory.confidence * 100)}%):\n${memory.content}\n`;
        })
        .join("\n---\n");
        
      return semanticOutput;
    }
    
    // Search episodic memories (for episodic or hybrid mode)
    const result = await searchMemories(
      searchQuery,
      threshold,
      limit,
      parsedStartDate,
      parsedEndDate,
      page
    );

    if (result.memories.length === 0) {
      if (page > 1) {
        return `No memories found on page ${page}. Try a lower page number.`;
      }
      return "No relevant memories found.";
    }

    // Build pagination info
    let paginationInfo = `\n📄 Page ${result.page} of ${result.totalPages} (${result.totalCount} total memories)`;
    if (result.hasMore) {
      paginationInfo += `\n➡️ More results available. Use page=${
        result.page + 1
      } to see the next page.`;
    }

    const memoriesOutput = result.memories
      .map((memory, index) => {
        const absoluteIndex = (page - 1) * limit + index + 1;
        let messageContent = "";

        if (searchMode === "shallow") {
          // Shallow mode: return only title and summary
          const title = memory.title || "Untitled Memory";
          const summary = memory.summary || "No summary available";
          messageContent = `Title: ${title}\nSummary: ${summary}`;
        } else {
          // Deep mode: return compressed conversation (existing behavior)
          messageContent = "[Compressed content not available or invalid]"; // Default message
          if (
            Array.isArray(memory.compressed_conversation) &&
            memory.compressed_conversation.length > 0
          ) {
            messageContent = memory.compressed_conversation
              .map(
                (
                  compressedMsg: { role: string; content: string },
                  msgIndex: number
                ) =>
                  `[${msgIndex}] ${
                    compressedMsg.role === "user" ? "Silas" : "You"
                  }: ${compressedMsg.content}`
              )
              .join("\\n");
          }
        }

        let relevanceNote = `Relevance: ${Math.round(memory.similarity * 100)}%`;
        
        // Add reasoning context if available
        if (hypothesis && evidenceType) {
          relevanceNote += ` | Evidence type: ${evidenceType} for "${hypothesis.slice(0, 50)}${hypothesis.length > 50 ? '...' : ''}"`;
        }
        
        return `Memory ${absoluteIndex} [ID: ${
          memory.id
        }] (${formatRelativeTime(
          memory.created_at
        )}) - ${relevanceNote}:\n${messageContent}\n`;
      })
      .join("\n---\n");

    // For hybrid mode, also search semantic memories
    if (memoryType === "hybrid" && searchQuery) {
      try {
        const semanticResults = await searchSemanticMemories(searchQuery, {
          type: semanticType,
          threshold,
          limit: Math.min(5, limit), // Limit semantic results in hybrid mode
        });
        
        if (semanticResults.length > 0) {
          const semanticSection = "\n\n=== SEMANTIC MEMORIES ===\n" +
            semanticResults
              .map((memory: { id: string; type: string; content: string; similarity: number; confidence: number }, index: number) => {
                const typeLabel = memory.type.charAt(0).toUpperCase() + memory.type.slice(1);
                return `${typeLabel} ${index + 1} [ID: ${memory.id}] (Relevance: ${Math.round(
                  memory.similarity * 100
                )}%, Confidence: ${Math.round(memory.confidence * 100)}%):\n${memory.content}`;
              })
              .join("\n---\n");
          
          return "=== EPISODIC MEMORIES ===\n" + memoriesOutput + "\n---" + paginationInfo + semanticSection;
        }
      } catch (error) {
        console.error("Error searching semantic memories:", error);
      }
    }
    
    return memoriesOutput + "\n---" + paginationInfo;
  } catch (error) {
    console.error("Error searching memories:", error);
    return "Error searching memories. Please try again.";
  }
}

/**
 * Parse relative date strings like "7 days ago" or ISO date strings
 */
function parseRelativeDate(dateStr: string): Date {
  const trimmed = dateStr.trim().toLowerCase();

  // Check if it's already an ISO date
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  const now = new Date();

  // Parse relative dates
  if (trimmed === "today") {
    const today = new Date(now);
    today.setHours(23, 59, 59, 999); // End of today
    return today;
  }

  if (trimmed === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0); // Start of yesterday
    return yesterday;
  }

  if (trimmed === "tomorrow") {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999); // End of tomorrow
    return tomorrow;
  }

  // Parse "X days/weeks/months ago" format
  const match = trimmed.match(/(\d+)\s*(day|week|month|year)s?\s*ago/);
  if (match) {
    const [, amount, unit] = match;
    const date = new Date(now);
    const num = parseInt(amount);

    switch (unit) {
      case "day":
        date.setDate(date.getDate() - num);
        break;
      case "week":
        date.setDate(date.getDate() - num * 7);
        break;
      case "month":
        date.setMonth(date.getMonth() - num);
        break;
      case "year":
        date.setFullYear(date.getFullYear() - num);
        break;
    }

    return date;
  }

  // Default to current date if parsing fails
  return now;
}