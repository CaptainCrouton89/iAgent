import { createClient } from "@/utils/supabase/server";
import { tool } from "ai";
import { z } from "zod";

/**
 * Tool for inspecting the raw conversation data of a specific memory
 */
export const memoryInspectTool = tool({
  description:
    "Inspect the raw conversation transcript of a specific memory by its ID. Returns the full message history with all details.",
  parameters: z.object({
    memoryId: z.string().describe("The ID of the memory to inspect"),
    startIndex: z
      .number()
      .min(0)
      .optional()
      .describe("Starting index of messages to retrieve (0-based)"),
    endIndex: z
      .number()
      .min(0)
      .optional()
      .describe("Ending index of messages to retrieve (inclusive)"),
  }),
  execute: async ({ memoryId, startIndex, endIndex }) => {
    try {
      const supabase = await createClient();
      
      // Get the current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return "Authentication error: Unable to verify user.";
      }
      
      console.log("Inspecting memory with ID:", memoryId, "for user:", user.id);

      // Fetch the memory by ID
      const { data: memory, error } = await supabase
        .from("memories")
        .select("id, content, compressed_conversation, context, created_at")
        .eq("id", memoryId)
        .eq("auth_id", user.id)
        .single();

      if (error || !memory) {
        console.error("Error fetching memory:", error);
        return `Memory with ID ${memoryId} not found or access denied. Error: ${error?.message || 'No memory found'}`;
      }

      // Parse the content field
      let messages = [];
      try {
        if (Array.isArray(memory.content)) {
          messages = memory.content;
        } else if (typeof memory.content === 'string') {
          messages = JSON.parse(memory.content);
        } else {
          return "Invalid memory content format.";
        }
      } catch {
        return "Error parsing memory content.";
      }

      // Apply index filtering if provided
      const start = startIndex ?? 0;
      const end = endIndex ?? messages.length - 1;
      
      if (start > messages.length - 1 || end > messages.length - 1) {
        return `Invalid index range. Memory contains ${messages.length} messages (indices 0-${messages.length - 1}).`;
      }

      const selectedMessages = messages.slice(start, end + 1);

      // Format the output
      let output = `Memory ID: ${memory.id}\n`;
      output += `Created: ${new Date(memory.created_at).toLocaleString()}\n`;
      output += `Total Messages: ${messages.length}\n`;
      output += `Showing: Messages ${start}-${end}\n`;
      if (memory.context) {
        output += `Context: ${memory.context}\n`;
      }
      output += `\n--- Conversation Transcript ---\n\n`;

      selectedMessages.forEach((message: { role?: string; parts?: Array<{ type: string; text?: string; toolCall?: { toolName: string; args: unknown }; toolResult?: { toolName: string; result: unknown } }>; content?: string }, index: number) => {
        const actualIndex = start + index;
        output += `[Message ${actualIndex}] ${message.role?.toUpperCase() || 'UNKNOWN'}:\n`;
        
        if (message.parts && Array.isArray(message.parts)) {
          message.parts.forEach((part) => {
            if (part.type === 'text' && part.text) {
              output += `${part.text}\n`;
            } else if (part.type === 'tool-call' && part.toolCall) {
              output += `[Tool Call: ${part.toolCall.toolName}]\n`;
              output += `Args: ${JSON.stringify(part.toolCall.args, null, 2)}\n`;
            } else if (part.type === 'tool-result' && part.toolResult) {
              output += `[Tool Result: ${part.toolResult.toolName}]\n`;
              output += `Result: ${typeof part.toolResult.result === 'string' 
                ? part.toolResult.result 
                : JSON.stringify(part.toolResult.result, null, 2)}\n`;
            }
          });
        } else if (message.content) {
          // Fallback for simple message format
          output += `${message.content}\n`;
        }
        
        output += `\n`;
      });

      return output;
    } catch (error) {
      console.error("Error inspecting memory:", error);
      return "Error inspecting memory. Please try again.";
    }
  },
});