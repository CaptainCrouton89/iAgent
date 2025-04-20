import { AIService } from "@/services/aiService";
import { ContactsService } from "@/services/contactsService";
import { MemoryService } from "@/services/memoryService";
import { SupabaseService } from "@/services/supabaseService";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
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

    console.log(`[Planner API] Setting up streaming response`);

    // Create a streaming response using Vercel AI SDK
    const result = await generateText({
      model: openai("gpt-4.1-2025-04-14"),
      system:
        "You are an AI Planner Assistant that helps users organize tasks, plan projects, and manage their time effectively. Provide clear, structured advice for planning and organization.",
      prompt: userMessage,
      tools: {
        search: perplexityClient.searchTool,
        searchWithDateRange: perplexityClient.searchWithDateRangeTool,
      },
      maxSteps: 5,
    });

    return new Response(result.text);
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
