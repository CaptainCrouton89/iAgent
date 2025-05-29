import {
  createOrUpdateSelfConcept,
  getSelfConcept,
} from "@/actions/self-concept";
import { Message } from "@/types/chat";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { assessChatMode } from "./mode-assessment";
import {
  ACTION_SYSTEM_PROMPT,
  BASE_SYSTEM_PROMPT,
  BRAINSTORM_SYSTEM_PROMPT,
  REFLECTIVE_SYSTEM_PROMPT,
} from "./prompts";
import {
  createReasoningDeveloperMessage,
  extractMemorySearchContext,
  processConsciousThought,
} from "./reasoning-processor";
import { buildSystemPromptWithSelfConcept } from "./self-concept-builder";
import { createMemoryChatStream } from "./stream-handler";
import { getToolsForMode, toolExecutors } from "./tool-sets";
import { ChatRequestBody } from "./types";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

/**
 * Converts our custom Message format to OpenAI's ChatCompletionMessageParam format
 */
function convertMessagesToOpenAI(
  messages: Message[]
): ChatCompletionMessageParam[] {
  return messages.map((message): ChatCompletionMessageParam => {
    // Handle tool messages
    if (message.role === "tool") {
      return {
        role: "tool",
        content: message.content || "",
        tool_call_id: message.tool_call_id || "",
      };
    }

    // Handle other roles (user, assistant, system, developer)
    if (message.role === "developer") {
      return {
        role: "developer" as const,
        content: message.content || "",
      } as ChatCompletionMessageParam;
    }

    // Handle standard roles
    return {
      role: message.role as "user" | "assistant" | "system",
      content: message.content || "",
    };
  });
}

export async function POST(req: Request) {
  try {
    const {
      messages,
      currentEmotion,
      thinkingDepth,
      memorySearchRequired,
      interactionLessons,
      consciousThought,
      reasoningContext,
    }: ChatRequestBody = await req.json();

    console.log("Meta", {
      currentEmotion,
      thinkingDepth,
      memorySearchRequired,
      interactionLessons,
      consciousThought,
    });
    // Convert our custom Message format to OpenAI format for mode assessment
    const convertedMessages = convertMessagesToOpenAI(messages);

    // Assess what mode to use
    const chatMode = await assessChatMode(convertedMessages);
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

    // Convert messages to ExtendedMessageParam type and inject enhanced conscious thought if provided
    // Note: Action mode skips conscious thought processing for efficiency
    const processedMessages: ChatCompletionMessageParam[] = [
      ...convertedMessages,
    ];
    if (consciousThought && chatMode !== "action") {
      // Process conscious thought for structured reasoning
      const processedThought = processConsciousThought(
        consciousThought,
        reasoningContext
      );

      // Create enhanced developer message with reasoning context
      const reasoningContent = createReasoningDeveloperMessage(
        processedThought,
        reasoningContext
      );

      // Add developer message right before the last user message
      const lastUserIndex = processedMessages.length - 1;
      const developerMessage: ChatCompletionMessageParam = {
        role: "developer",
        content: reasoningContent,
      };
      processedMessages.splice(lastUserIndex, 0, developerMessage);

      console.log("Injected enhanced conscious thought with reasoning:", {
        originalThought: consciousThought.slice(0, 100),
        structuredThoughts: processedThought.structuredThoughts.length,
        qualityScore: processedThought.qualityScore,
        hasReasoningState: !!processedThought.reasoningState,
        reasoningMode: reasoningContext?.mode,
      });
    }

    // Select base prompt based on mode
    let basePrompt: string;
    switch (chatMode) {
      case "brainstorm":
        basePrompt = BRAINSTORM_SYSTEM_PROMPT;
        break;
      case "reflective":
        basePrompt = REFLECTIVE_SYSTEM_PROMPT;
        break;
      case "action":
        basePrompt = ACTION_SYSTEM_PROMPT;
        break;
      default:
        basePrompt = BASE_SYSTEM_PROMPT;
        break;
    }

    // Build dynamic system prompt with self-concept
    const dynamicSystemPrompt = buildSystemPromptWithSelfConcept(
      basePrompt,
      selfConcept,
      interactionLessons,
      currentEmotion
    );

    // Add developer message for memory search if required
    if (memorySearchRequired) {
      const memorySearchDeveloperMessage: ChatCompletionMessageParam = {
        role: "developer",
        content:
          "The user has introduced new information or referenced topics that require memory context. Search your memories first using searchMemories to gather relevant background information before responding.",
      };
      processedMessages.push(memorySearchDeveloperMessage);
    }

    console.log("Emotion", currentEmotion);
    console.log("Self-concept loaded:", selfConcept ? "Yes" : "No");

    // Extract memory search context for enhanced tool usage (skip for action mode)
    const memoryContext =
      consciousThought && chatMode !== "action"
        ? extractMemorySearchContext(
            processConsciousThought(consciousThought, reasoningContext)
              .reasoningState,
            reasoningContext
          )
        : undefined;

    // Get tools based on mode
    const toolDefinitions = getToolsForMode(chatMode);

    // Create and return the streaming response with enhanced context
    const readableStream = await createMemoryChatStream(
      dynamicSystemPrompt,
      processedMessages,
      toolDefinitions,
      toolExecutors,
      memoryContext
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
