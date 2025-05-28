import { formatRelativeTime } from "@/utils/dateFormat";
import { searchMemories } from "@/utils/supabase/memory-search";
import { tool } from "ai";
import { z } from "zod";

/**
 * Tool for searching memories using semantic similarity and date ranges with pagination
 */
export const memorySearchTool = tool({
  description:
    "Search for previous conversations or memories using semantic similarity and optional date filtering. Supports pagination to browse through multiple results. Use 'deep' mode for full compressed conversations or 'shallow' mode for just titles and summaries.",
  parameters: z.object({
    query: z
      .string()
      .optional()
      .describe(
        "The search query to find relevant memories (optional - leave empty to search all memories in date range)"
      ),
    threshold: z
      .number()
      .min(0)
      .max(1)
      .default(0.7)
      .describe("Similarity threshold (.6-.9)"),
    limit: z
      .number()
      .min(1)
      .max(10)
      .describe("Maximum number of results per page"),
    searchMode: z
      .enum(["deep", "shallow"])
      .describe(
        "Search mode: 'deep' returns full compressed conversations, 'shallow' returns only titles and summaries"
      ),
    page: z
      .number()
      .min(1)
      .default(1)
      .describe("Page number (1-based) for paginated results"),
    startDate: z
      .string()
      .optional()
      .describe(
        "Start date for search range (ISO format or relative like '7 days ago')"
      ),
    endDate: z
      .string()
      .optional()
      .describe(
        "End date for search range (ISO format or relative like 'today')"
      ),
  }),
  execute: async ({
    query,
    threshold = 0.6,
    limit = 10,
    page = 1,
    startDate,
    endDate,
    searchMode = "deep",
  }) => {
    try {
      // Parse relative dates if provided
      let parsedStartDate: Date | undefined;
      let parsedEndDate: Date | undefined;

      if (startDate) {
        parsedStartDate = parseRelativeDate(startDate);
      }

      if (endDate) {
        parsedEndDate = parseRelativeDate(endDate);
      }

      // If no query is provided but dates are, we'll search for all memories in that time range
      const searchQuery = query || "";

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

          return `Memory ${absoluteIndex} [ID: ${
            memory.id
          }] (${formatRelativeTime(
            memory.created_at
          )}) - Relevance: ${Math.round(
            memory.similarity * 100
          )}%:\n${messageContent}\n`;
        })
        .join("\n---\n");

      return memoriesOutput + "\n---" + paginationInfo;
    } catch (error) {
      console.error("Error searching memories:", error);
      return "Error searching memories. Please try again.";
    }
  },
});

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
    return new Date(now.setHours(0, 0, 0, 0));
  }

  if (trimmed === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return yesterday;
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
