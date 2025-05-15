import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const result = streamText({
      model: openai("gpt-4.1"),
      messages,
      // Enable streaming of tool calls
      toolCallStreaming: true,
      // Allow multiple steps for tool usage
      maxSteps: 5,
      tools: {
        // Example tool - you can add more tools here
        getSystemInfo: {
          description: "Get information about the system",
          parameters: z.object({
            type: z
              .string()
              .describe("The type of system information to retrieve"),
          }),
          execute: async ({ type }: { type: string }) => {
            // Example implementation
            return `System info for ${type}`;
          },
        },
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Error in chat route:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
