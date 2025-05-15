import { searchMemories } from "@/utils/supabase/memory-search";
import { tool } from "ai";
import { z } from "zod";

/**
 * Tool for searching memories using semantic similarity
 */
export const memorySearchTool = tool({
  description:
    "Search for previous conversations or memories using semantic similarity",
  parameters: z.object({
    query: z.string().describe("The search query to find relevant memories"),
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
      .default(3)
      .describe("Maximum number of results to return"),
  }),
  execute: async ({ query, threshold = 0.6, limit = 10 }) => {
    try {
      const memories = await searchMemories(query, threshold, limit);

      if (memories.length === 0) {
        return "No relevant memories found.";
      }

      return memories
        .map((memory, index) => {
          // Format the content - since we're storing messages as a complete array
          const messageContent = Array.isArray(memory.content)
            ? memory.content
                .map(
                  (msg) =>
                    `${msg.role}: ${
                      msg.parts
                        ?.map((part) =>
                          part.type === "text"
                            ? part.text
                            : `[Tool: ${part.type}]`
                        )
                        .join(" ") || ""
                    }`
                )
                .join("\n")
            : JSON.stringify(memory.content);

          return `Memory ${index + 1} (${new Date(
            memory.created_at
          ).toLocaleString()}) - Relevance: ${Math.round(
            memory.similarity * 100
          )}%:\n${messageContent}\n`;
        })
        .join("\n---\n");
    } catch (error) {
      console.error("Error searching memories:", error);
      return "Error searching memories. Please try again.";
    }
  },
});
