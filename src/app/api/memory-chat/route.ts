import {
  createOrUpdateSelfConcept,
  getSelfConcept,
} from "@/actions/self-concept";
import { memorySearchToolDefinition } from "@/tools/openai/memory-search";
import { memoryInspectToolDefinition } from "@/tools/openai/memory-inspect";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { assessChatMode } from "./mode-assessment";
import { BASE_SYSTEM_PROMPT, BRAINSTORM_SYSTEM_PROMPT } from "./prompts";
import { buildSystemPromptWithSelfConcept } from "./self-concept-builder";
import { createMemoryChatStream } from "./stream-handler";
import { ChatRequestBody } from "./types";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const {
      messages,
      currentEmotion,
      interactionLessons,
      consciousThought,
    }: ChatRequestBody = await req.json();

    // Assess what mode to use
    const chatMode = await assessChatMode(messages);
    console.log("Chat mode assessed:", chatMode);

    // Fetch or create the user's self-concept
    let selfConcept = await getSelfConcept();

    // If no self-concept exists, create a default one
    if (!selfConcept) {
      console.log("No self-concept found, creating default one...");
      selfConcept = await createOrUpdateSelfConcept({
        // Use the default values from the migration
        // These will be automatically applied due to the database defaults
      });
      console.log("Created default self-concept with ID:", selfConcept.id);
    }

    // Convert messages to ExtendedMessageParam type and inject conscious thought if provided
    const processedMessages: ChatCompletionMessageParam[] = [...messages];
    if (consciousThought) {
      // Add developer message right before the last user message
      const lastUserIndex = processedMessages.length - 1;
      const developerMessage: ChatCompletionMessageParam = {
        role: "developer",
        content: `<internal_thoughts>${consciousThought}</internal_thoughts>`,
      };
      processedMessages.splice(lastUserIndex, 0, developerMessage);
      console.log("Injected conscious thought:", consciousThought);
      console.log(
        "Messages with conscious thought:",
        processedMessages.map((m) => ({
          role: m.role,
          content: m.content?.slice(0, 50) + "...",
        }))
      );
    }

    // Select base prompt based on mode
    const basePrompt = chatMode === 'brainstorm' ? BRAINSTORM_SYSTEM_PROMPT : BASE_SYSTEM_PROMPT;

    // Build dynamic system prompt with self-concept
    const dynamicSystemPrompt = buildSystemPromptWithSelfConcept(
      basePrompt,
      selfConcept,
      interactionLessons,
      currentEmotion
    );

    console.log("Emotion", currentEmotion);
    console.log("Self-concept loaded:", selfConcept ? "Yes" : "No");

    // Create and return the streaming response
    const readableStream = await createMemoryChatStream(
      dynamicSystemPrompt,
      processedMessages,
      [memorySearchToolDefinition, memoryInspectToolDefinition]
    );

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in chat route:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
