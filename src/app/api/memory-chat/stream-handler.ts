import { OpenAI } from "openai";
import { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { executeMemorySearch } from "@/tools/openai/memory-search";
import { executeMemoryInspect } from "@/tools/openai/memory-inspect";
import { MemorySearchContext } from "./types";

type ToolExecutor = (args: Record<string, unknown>) => Promise<string>;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function createMemoryChatStream(
  systemPrompt: string,
  messages: ChatCompletionMessageParam[],
  toolDefinitions: ChatCompletionTool[],
  toolExecutors: Record<string, ToolExecutor> = {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _memoryContext?: MemorySearchContext
): Promise<ReadableStream> {
  // Create the streaming chat completion
  const stream = await openai.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0.7,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    tools: toolDefinitions,
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

                if (toolCall.name === "searchMemories") {
                  result = await executeMemorySearch(args);
                } else if (toolCall.name === "inspectMemory") {
                  result = await executeMemoryInspect(args);
                } else if (toolExecutors[toolCall.name]) {
                  result = await toolExecutors[toolCall.name](args);
                } else {
                  result = "Unknown tool";
                }

                // Send complete tool call with arguments before result
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "tool-call-complete",
                      toolCallId: toolCall.id,
                      toolName: toolCall.name,
                      args: args, // Send parsed args
                    })}\n\n`
                  )
                );

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