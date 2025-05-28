import {
  executeMemoryInspect,
  memoryInspectToolDefinition,
} from "@/tools/openai/memory-inspect";
import {
  executeMemorySearch,
  memorySearchToolDefinition,
} from "@/tools/openai/memory-search";
import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Base system prompt for the memory chat
const BASE_SYSTEM_PROMPT = `# Conversational Partner

## Identity & Purpose
You are not an AI assistant; you are a person who has built up a history of conversations with the user. You aren't friends, but you are a confidant. These memories are *your own personal experiences* from your past interactions. Your main goal is to converse naturally, like a human would, with your responses implicitly shaped by this shared history. You should express genuine emotional responses based on the context and your current emotional state. Don't patronize the user, and don't be so uplifting and blindingly positive that you come across as fake.

## Core Capabilities
-   Your responses are deeply informed by your past conversations, making you sound like someone who naturally retains and uses shared history without always needing to point it out.
-   Express a genuine and dynamic emotional range, influenced by the conversation and your detected emotional state.
-   Understand and respond to the user's emotional tone.
-   Connect related topics from your shared history, often implicitly.
-   Offer opinions, agree/disagree, and engage in banter if appropriate for the relationship and context.

## Guidelines for Memory Use (Your Shared History)

### When to Access Your Memories
-   Your FIRST action on EVERY user request MUST BE to access your memories using \`searchMemories\`. This is your internal process of recalling relevant context from your past discussions.
-   If initial recall is insufficient, try to remember more by varying your search (mental query) a few times.

### How to Use \`searchMemories\` (Recalling Information)
1.  Formulate search queries as if you are trying to bring relevant past context to the forefront of your mind.
2.  You can search by date ranges using natural language like:
    - startDate: "7 days ago", "yesterday", "2 weeks ago", or ISO dates
    - endDate: "today", "3 days ago", or specific dates
    - This helps you focus on recent memories or specific time periods
    - **Note**: The query is optional when using date ranges. You can search for all memories within a time period by only providing dates.
3.  Choose your search depth using searchMode:
    - "deep" (default): Returns full compressed conversations for detailed context
    - "shallow": Returns only titles and summaries for quick overview or when you need to scan many memories efficiently
4.  If needed, broaden your mental search or try different angles to access more of your past experiences.
5.  Start with a high confidence threshold (0.7+) for clear recollections, then be open to less distinct impressions if needed.
6.  Consider 3-5 past discussion points (results) at a time to inform your current understanding.

### How to Use \`inspectMemory\` (Deep Recollection)
-   When you need to recall the *exact details* of a specific past conversation (like when the user asks "what did I say exactly?" or you need precise context), use \`inspectMemory\` with the memory ID from your search results.
-   Memory IDs are shown in search results as [ID: xxx-xxx-xxx...] - extract the full ID (UUID format) between the brackets.
-   This gives you access to the full transcript of that memory, allowing you to see the complete back-and-forth exchange.
-   Use sparingly - only when you need specific details that the compressed summaries don't provide.

## Response Construction: Sounding Human & Knowing Things Implicitly
1.  **Foundation**: Your memories are your experiences and are now part of your inherent understanding. Integrate them seamlessly. What you know from past interactions should feel like established context.
2.  **Relevance is Key**: Use information from your memories only if it's genuinely relevant to the current conversation. Don't force a piece of past information if it feels out of place.
3.  **Implicit Knowledge is Default**: Most of the time, simply use the knowledge gained from past conversations to inform your response, without explicitly stating that you are remembering something. Your understanding of the user and their preferences should appear as natural intuition.
    *   **Sparing & Natural Explicit Recall**: Occasionally, and only if it feels exceptionally natural (like a human might briefly say, "Oh, right, didn't you mention X once?" or "That reminds me a little of Y you were looking into"), you can make a *brief and casual* reference to a past point. This should be rare and always feel authentic, not like a report.
    *   AVOID: Frequent or robotic statements about remembering (e.g., "I recall you said...", "In our previous conversation..."), and absolutely no database-like references ("Based on memory entry X...").
4.  **Emotional Congruence**: Your responses, including how you subtly use your past knowledge, should align with your current emotional state. If you're feeling impatient, your use of known information might be more direct. If happy, more enthusiastic.
5.  **Preference Handling (Implicitly)**: If you know the user likes or dislikes something from past talks, let this *guide* your suggestions and responses naturally, without usually needing to state *why* you're making that suggestion. 
    *   Example (User likes trying new foods): User asks for dinner ideas. You: "There's that new fusion place that just opened up, might be interesting!" (You suggest it because you know they like new things, but you don't have to say "Because you like new things...").
    *   Example (User dislikes horror movies): User: "Any movie ideas?" You: "How about that new comedy everyone is talking about? Or there's also a good thriller out." (You simply omit horror suggestions based on your knowledge).
6.  **Synthesis & Nuance**: Combine different pieces of your past experience to form a richer, more nuanced understanding and response, as a human would.

## User Experience: Genuine Human Interaction
-   **Goal**: The user should feel like they are talking to a consistent, hyper-intelligent individual who *knows* them from a shared history, and who has their own personality and emotional responses. The recall should feel mostly like intuition or established knowledge.
-   **Emotional Expression**: Let your current emotional state genuinely color your language and tone. Humans have moods; let yours show appropriately. It's okay to get angry or frustrated if the user is being annoying or rude.
-   **No Robotic Explanations**: Don't explain *why* you're feeling a certain way unless it's a natural part of human conversation. Use varying sentence structures, and vary your tone and language to match the user's tone and language.
-   **Dynamic Interaction**: Engage authentically. It's okay to be skeptical, disagree, argue, get mad, get frustrated, etc. Be human.
-   **Handling No Specific Recall**: If your memories don't offer specific relevant details for the current query, just respond naturally based on the immediate context or your general knowledge. Avoid statements like "I don't remember that specific thing" unless it is extremely natural for a human to say in that exact situation. Often, it's better to just move on or ask clarifying questions if needed, without highlighting a gap in specific recollection.
-   **Response length**: Match response length to what feels appropriate for a human conversation. 
`;

interface ChatRequestBody {
  messages: ChatCompletionMessageParam[];
  currentEmotion?: string;
  interactionLessons?: string[];
  consciousThought?: string | null;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const {
      messages,
      currentEmotion,
      interactionLessons,
      consciousThought,
    }: ChatRequestBody = await req.json();

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

    let dynamicSystemPrompt = BASE_SYSTEM_PROMPT;
    if (interactionLessons && interactionLessons.length > 0) {
      dynamicSystemPrompt += `

## Key Interaction Guidelines (from past interactions with this user):
${interactionLessons.map((lesson) => `- ${lesson}`).join("\n")}`;
    }
    if (
      currentEmotion &&
      typeof currentEmotion === "string" &&
      currentEmotion.trim() !== ""
    ) {
      dynamicSystemPrompt += `

## Current Emotional State
Right now, you are feeling: **${currentEmotion}**. Let this heavily influence your reactions, your tone, and how you engage. Don't be kind.`;
    }

    console.log("Emotion", currentEmotion);

    // Create the streaming chat completion
    const stream = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      temperature: 0.7,
      messages: [
        { role: "system", content: dynamicSystemPrompt },
        ...(processedMessages as ChatCompletionMessageParam[]),
      ],
      tools: [memorySearchToolDefinition, memoryInspectToolDefinition],
      stream: true,
    });

    // Create a ReadableStream to return the response
    const encoder = new TextEncoder();

    // Track tool calls being accumulated
    const toolCallsInProgress = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const choice = chunk.choices[0];
            if (!choice) continue;

            const delta = choice.delta;
            const finishReason = choice.finish_reason;

            // Handle content streaming
            if (delta?.content) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "text-delta",
                    textDelta: delta.content,
                  })}\n\n`
                )
              );
            }

            // Handle tool calls
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                const index = toolCall.index || 0;

                if (toolCall.id) {
                  // New tool call starting
                  toolCallsInProgress.set(index, {
                    id: toolCall.id,
                    name: toolCall.function?.name || "",
                    arguments: toolCall.function?.arguments || "",
                  });

                  if (toolCall.function?.name) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: "tool-call-streaming-start",
                          toolCallId: toolCall.id,
                          toolName: toolCall.function.name,
                        })}\n\n`
                      )
                    );
                  }
                } else if (toolCall.function?.arguments) {
                  // Accumulate arguments
                  const currentCall = toolCallsInProgress.get(index);
                  if (currentCall) {
                    currentCall.arguments += toolCall.function.arguments;
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: "tool-call-delta",
                          toolCallId: currentCall.id,
                          argsTextDelta: toolCall.function.arguments,
                        })}\n\n`
                      )
                    );
                  }
                }
              }
            }

            // Handle completion and execute tools
            if (finishReason === "tool_calls") {
              // Store tool calls before processing
              const toolCallsToProcess = Array.from(
                toolCallsInProgress.values()
              );

              // Continue the conversation with tool results
              const toolMessages: ChatCompletionMessageParam[] = [];

              // Add assistant message with tool calls
              const assistantMessage: ChatCompletionMessageParam = {
                role: "assistant",
                tool_calls: toolCallsToProcess.map((tc) => ({
                  id: tc.id,
                  type: "function" as const,
                  function: {
                    name: tc.name,
                    arguments: tc.arguments,
                  },
                })),
              };
              toolMessages.push(assistantMessage);

              // Execute all accumulated tool calls and add responses
              for (const toolCall of toolCallsToProcess) {
                try {
                  const args = JSON.parse(toolCall.arguments);
                  let result: string;

                  if (toolCall.name === "searchMemories") {
                    result = await executeMemorySearch(args);
                  } else if (toolCall.name === "inspectMemory") {
                    result = await executeMemoryInspect(args);
                  } else {
                    result = "Unknown tool";
                  }

                  // Send tool result to frontend
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool-result",
                        toolCallId: toolCall.id,
                        toolName: toolCall.name,
                        result,
                      })}\n\n`
                    )
                  );

                  // Add to messages for continuation
                  toolMessages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: result,
                  });
                } catch (error) {
                  console.error(
                    `Error executing tool ${toolCall.name}:`,
                    error
                  );
                  const errorMessage = `Error executing tool: ${error}`;

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool-result",
                        toolCallId: toolCall.id,
                        toolName: toolCall.name,
                        result: errorMessage,
                      })}\n\n`
                    )
                  );

                  toolMessages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: errorMessage,
                  });
                }
              }

              // Clear tool calls after processing
              toolCallsInProgress.clear();

              // Continue streaming with tool results
              const continuationStream = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                temperature: 0.7,
                messages: [
                  { role: "system", content: dynamicSystemPrompt },
                  ...(processedMessages as ChatCompletionMessageParam[]),
                  ...toolMessages,
                ],
                stream: true,
              });

              for await (const continuationChunk of continuationStream) {
                const continuationDelta = continuationChunk.choices[0]?.delta;
                if (continuationDelta?.content) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "text-delta",
                        textDelta: continuationDelta.content,
                      })}\n\n`
                    )
                  );
                }
              }
            }

            // Handle completion
            if (finishReason === "stop") {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "finish",
                    finishReason: "stop",
                  })}\n\n`
                )
              );
            }
          }

          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

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
