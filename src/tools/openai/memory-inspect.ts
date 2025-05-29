import { createClient } from "@/utils/supabase/server";
import { ChatCompletionTool } from "openai/resources/chat/completions";
import { MemoryInspectParameters } from "@/types/openai-chat";

export const memoryInspectToolDefinition: ChatCompletionTool = {
  type: "function",
  function: {
    name: "inspectMemory",
    description:
      "Inspect the raw conversation transcript of a specific memory by its ID. Enhanced to extract evidence for hypothesis testing and reasoning. Returns the full message history with all details.",
    parameters: {
      type: "object",
      properties: {
        memoryId: {
          type: "string",
          description: "The ID of the memory to inspect",
        },
        startIndex: {
          type: "number",
          description: "Starting index of messages to retrieve (0-based)",
          minimum: 0,
        },
        endIndex: {
          type: "number",
          description: "Ending index of messages to retrieve (inclusive)",
          minimum: 0,
        },
        reasoningContext: {
          type: "string",
          description: "Current reasoning context or hypothesis being investigated",
        },
        extractEvidence: {
          type: "boolean",
          description: "Whether to highlight evidence relevant to current reasoning context",
          default: false,
        },
      },
      required: ["memoryId"],
    },
  },
};

export async function executeMemoryInspect(params: MemoryInspectParameters & { reasoningContext?: string; extractEvidence?: boolean }): Promise<string> {
  try {
    const { memoryId, startIndex, endIndex, reasoningContext, extractEvidence } = params;
    
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
      .select("id, content, compressed_conversation, context, created_at, strength")
      .eq("id", memoryId)
      .eq("auth_id", user.id)
      .single();

    if (error || !memory) {
      console.error("Error fetching memory:", error);
      return `Memory with ID ${memoryId} not found or access denied. Error: ${error?.message || 'No memory found'}`;
    }
    
    // Update memory usage - boost strength and update last_used
    const newStrength = Math.min(1.0, (memory.strength || 0.5) + 0.1);
    const { error: updateError } = await supabase
      .from("memories")
      .update({
        last_used: new Date().toISOString(),
        strength: newStrength,
      })
      .eq("id", memoryId)
      .eq("auth_id", user.id);
      
    if (updateError) {
      console.error("Error updating memory usage:", updateError);
      // Continue even if update fails
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

    // Format the output with reasoning enhancements
    let output = `Memory ID: ${memory.id}\n`;
    output += `Created: ${new Date(memory.created_at).toLocaleString()}\n`;
    output += `Total Messages: ${messages.length}\n`;
    output += `Showing: Messages ${start}-${end}\n`;
    if (memory.context) {
      output += `Context: ${memory.context}\n`;
    }
    if (reasoningContext) {
      output += `Reasoning Context: ${reasoningContext}\n`;
    }
    if (extractEvidence) {
      output += `Evidence Extraction: Enabled\n`;
    }
    output += `\n--- Conversation Transcript ---\n\n`;

    selectedMessages.forEach((message: { role?: string; parts?: Array<{ type: string; text?: string; toolCall?: { toolName: string; args: unknown }; toolResult?: { toolName: string; result: unknown } }>; content?: string }, index: number) => {
      const actualIndex = start + index;
      let messageContent = '';
      let evidenceFound = false;
      
      // Extract message content
      if (message.parts && Array.isArray(message.parts)) {
        message.parts.forEach((part) => {
          if (part.type === 'text' && part.text) {
            messageContent += part.text;
            
            // Check for evidence if reasoning context provided
            if (extractEvidence && reasoningContext && part.text.toLowerCase().includes(reasoningContext.toLowerCase().substring(0, 20))) {
              evidenceFound = true;
            }
          } else if (part.type === 'tool-call' && part.toolCall) {
            messageContent += `[Tool Call: ${part.toolCall.toolName}]\nArgs: ${JSON.stringify(part.toolCall.args, null, 2)}`;
          } else if (part.type === 'tool-result' && part.toolResult) {
            const resultContent = typeof part.toolResult.result === 'string' 
              ? part.toolResult.result 
              : JSON.stringify(part.toolResult.result, null, 2);
            messageContent += `[Tool Result: ${part.toolResult.toolName}]\nResult: ${resultContent}`;
            
            // Check tool results for evidence
            if (extractEvidence && reasoningContext && resultContent.toLowerCase().includes(reasoningContext.toLowerCase().substring(0, 20))) {
              evidenceFound = true;
            }
          }
        });
      } else if (message.content) {
        messageContent = message.content;
        if (extractEvidence && reasoningContext && message.content.toLowerCase().includes(reasoningContext.toLowerCase().substring(0, 20))) {
          evidenceFound = true;
        }
      }
      
      // Format message with evidence highlighting
      const evidenceMarker = evidenceFound ? ' 🎯 [EVIDENCE FOUND]' : '';
      output += `[Message ${actualIndex}] ${message.role?.toUpperCase() || 'UNKNOWN'}${evidenceMarker}:\n`;
      output += `${messageContent}\n\n`;
    });
    
    // Add evidence summary if extraction was enabled
    if (extractEvidence && reasoningContext) {
      const evidenceCount = selectedMessages.filter((msg: { role?: string; parts?: Array<{ type: string; text?: string; toolCall?: { toolName: string; args: unknown }; toolResult?: { toolName: string; result: unknown } }>; content?: string }) => {
        const content = msg.content || msg.parts?.map(p => p.text || '').join(' ') || '';
        return content.toLowerCase().includes(reasoningContext.toLowerCase().substring(0, 20));
      }).length;
      
      output += `\n--- Evidence Summary ---\n`;
      output += `Found ${evidenceCount} messages potentially relevant to: "${reasoningContext}"\n`;
    }

    return output;
  } catch (error) {
    console.error("Error inspecting memory:", error);
    return "Error inspecting memory. Please try again.";
  }
}