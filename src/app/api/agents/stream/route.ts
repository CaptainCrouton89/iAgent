import { createClient } from "@/utils/supabase/server";
import { OpenAI } from "openai";
import { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import axios from "axios";

export const dynamic = "force-dynamic";
export const runtime = "edge";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

type ToolExecutor = (args: Record<string, unknown>) => Promise<string | { result: string; [key: string]: unknown }>;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create agent-specific tool executors with userId
const createAgentToolExecutors = (userId: string): Record<string, ToolExecutor> => ({
  helloWorld: async (args: Record<string, unknown>) => {
    const response = await axios.post(
      "http://localhost:3800/api/jobs",
      {
        toolName: "helloWorld",
        args,
      },
      {
        headers: {
          "x-user-id": userId,
        },
      }
    );
    return response.data;
  },
});

// Basic agent tool definitions (these would come from agent configuration)
const agentToolDefinitions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "helloWorld",
      description: "This is a tool that says hello world",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name to say hello to",
          },
        },
        required: ["name"],
      },
    },
  },
];

async function createAgentStream(
  agentId: string,
  userId: string,
  messages: ChatCompletionMessageParam[]
): Promise<ReadableStream> {
  // Get agent configuration (simplified for now)
  const systemPrompt = `You are a helpful AI assistant agent (ID: ${agentId}). Use tools when appropriate to help the user.`;

  // Create tool executors with the userId
  const agentToolExecutors = createAgentToolExecutors(userId);

  // Create the streaming chat completion
  const stream = await openai.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0.7,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    tools: agentToolDefinitions,
    stream: true,
  });

  // Create a ReadableStream to return the response
  const encoder = new TextEncoder();

  // Track tool calls being accumulated
  const toolCallsInProgress = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();

  return new ReadableStream({
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

                if (agentToolExecutors[toolCall.name]) {
                  const toolResult = await agentToolExecutors[toolCall.name](args);
                  result = typeof toolResult === 'string' ? toolResult : 
                    'result' in toolResult ? toolResult.result : JSON.stringify(toolResult);
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
              model: "gpt-4.1",
              temperature: 0.7,
              messages: [
                { role: "system", content: systemPrompt },
                ...messages,
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
}

export async function GET(request: Request) {
  // Get the agent ID from the request's URL
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return new Response(JSON.stringify({ error: "Agent ID is required" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // Get user ID from auth session
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || "";

  try {
    // Get existing messages from the external service
    const response = await axios.get(
      `http://localhost:3800/api/agents/${agentId}/messages`,
      {
        headers: {
          "x-user-id": userId,
        },
      }
    );

    const messages: ChatCompletionMessageParam[] = [];
    if (response.status === 200 && response.data?.messageHistory) {
      // Convert external service messages to OpenAI format
      for (const msg of response.data.messageHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }
    }

    // Create and return the streaming response
    const readableStream = await createAgentStream(agentId, userId, messages);

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in agent stream route:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
