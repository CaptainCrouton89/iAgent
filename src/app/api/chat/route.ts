import { AIService } from "@/services/aiService";
import { ContactsService } from "@/services/contactsService";
import { MemoryService } from "@/services/memoryService";
import { SupabaseService } from "@/services/supabaseService";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Initialize services
const supabaseService = new SupabaseService();
const aiService = new AIService({
  debug: process.env.NODE_ENV === "development",
  perplexityApiKey: process.env.PERPLEXITY_API_KEY,
  logLevel:
    (process.env.LOG_LEVEL as "none" | "minimal" | "detailed") || "minimal",
});
const memoryService = new MemoryService(supabaseService, aiService);
const contactsService = new ContactsService(supabaseService);

// Connect the services bidirectionally
aiService.setMemoryService(memoryService);
aiService.setContactsService(contactsService);

export async function POST(req: Request) {
  console.log(
    `[Chat API] Received chat request at ${new Date().toISOString()}`
  );

  try {
    const { messages } = await req.json();

    console.log(
      `[Chat API] Processing ${messages.length} messages in conversation`
    );

    // Get the user's most recent message
    const userMessage = messages[messages.length - 1].content;

    // Format previous messages as text
    const historyText = messages
      .slice(0, -1)
      .map(
        (msg: { role: string; content: string }) =>
          `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
      )
      .join("\n\n");

    // Combine history with current message
    const combinedMessage =
      historyText.length > 0
        ? `Previous conversation:\n${historyText}\n\nCurrent message:\n${userMessage}`
        : userMessage;

    console.log(`[Chat API] Prepared message with conversation history`);

    // Use the email response generator directly to test it
    // With fixed dummy parameters for the email fields
    const response = await aiService.generateEmailResponse({
      from: "Silas Rhyneer <rhyneer.silas@gmail.com>",
      subject: "Hey",
      body: combinedMessage,
      // Removed the history parameter to avoid the conflict
    });

    // Store the user's message as a memory if it's relevant
    try {
      console.log(
        `[Chat API] Evaluating memory relevance for message: ${userMessage.substring(
          0,
          50
        )}${userMessage.length > 50 ? "..." : ""}`
      );

      const relevanceResult = await aiService.evaluateMemoryRelevance({
        source: "chat",
        content: {
          message: userMessage,
        },
      });

      console.log(
        `[Chat API] Memory relevance score: ${relevanceResult.relevance}`
      );

      if (relevanceResult.relevance > 0.5) {
        console.log(
          `[Chat API] Storing chat message as memory with relevance ${relevanceResult.relevance}`
        );

        // Include conversation context for better memory processing
        const contextualContent =
          historyText.length > 0
            ? `Context from conversation:\n${historyText}\n\nMessage: ${userMessage}`
            : userMessage;

        await memoryService.createMemory({
          content: contextualContent,
          source: "chat",
          relevance_score: relevanceResult.relevance,
          source_id: undefined,
        });
        console.log(`[Chat API] Memory stored successfully`);
      } else {
        console.log(
          `[Chat API] Message not relevant enough for memory storage (score: ${relevanceResult.relevance})`
        );
      }
    } catch (error) {
      console.error("[Chat API] Error storing chat memory:", error);
      // Continue with the response even if memory storage fails
    }

    console.log(`[Chat API] Returning response to client`);

    // Create a proper response with the AI-generated text
    return new Response(
      JSON.stringify({
        text: response.text,
        role: "assistant",
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("[Chat API] Error processing chat request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
