import { AIService } from "@/services/aiService";
import { ContactsService } from "@/services/contactsService";
import { MemoryService } from "@/services/memoryService";
import { SupabaseService } from "@/services/supabaseService";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { PerplexityClient } from "../../../tools/perplexity";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Initialize services
const supabaseService = new SupabaseService();
const perplexityClient = new PerplexityClient({
  apiKey: process.env.PERPLEXITY_API_KEY,
});
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
    `[Planner API] Received planner request at ${new Date().toISOString()}`
  );

  try {
    const { messages } = await req.json();

    console.log(
      `[Planner API] Processing ${messages.length} messages in conversation`
    );

    // Get the user's most recent message
    const userMessage = messages[messages.length - 1].content;

    // Format previous messages for the AI model
    const previousMessages = messages.slice(0, -1);

    console.log(`[Planner API] Setting up streaming response`);

    // Create a streaming response using Vercel AI SDK
    const { textStream } = await streamText({
      model: openai("gpt-4.1-2025-04-14"),
      system:
        "You are an AI Planner Assistant that helps users organize tasks, plan projects, and manage their time effectively. Provide clear, structured advice for planning and organization.",
      messages: previousMessages,
      prompt: userMessage,
      tools: {
        search: perplexityClient.searchTool,
        searchWithDateRange: perplexityClient.searchWithDateRangeTool,
      },
      maxSteps: 5,
    });

    // Prepare for memory storage
    const relevanceEvaluationPromise = aiService.evaluateMemoryRelevance({
      source: "planner",
      content: {
        message: userMessage,
      },
    });

    // Return the streaming response
    console.log(`[Planner API] Returning streaming response to client`);

    // Create a streaming response from the textStream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of textStream) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    // Store memory asynchronously without blocking the response
    relevanceEvaluationPromise
      .then(async (relevanceResult) => {
        if (relevanceResult.relevance > 0.5) {
          console.log(
            `[Planner API] Storing message as memory with relevance ${relevanceResult.relevance}`
          );

          // Format conversation context
          const historyText = previousMessages
            .map(
              (msg: { role: string; content: string }) =>
                `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
            )
            .join("\n\n");

          const contextualContent =
            historyText.length > 0
              ? `Context from planner conversation:\n${historyText}\n\nMessage: ${userMessage}`
              : userMessage;

          await memoryService.createMemory({
            content: contextualContent,
            source: "planner",
            relevance_score: relevanceResult.relevance,
            source_id: undefined,
          });
          console.log(`[Planner API] Memory stored successfully`);
        }
      })
      .catch((error) => {
        console.error("[Planner API] Error storing memory:", error);
      });

    return new Response(stream);
  } catch (error) {
    console.error("[Planner API] Error processing request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process planner request" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
