import { streamOpenAI } from "@/lib/chat/streamOpenAi";
import { streamThoughts } from "@/tools/sequential-thinking";
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./constants";

export const runtime = "edge";

async function inspectAndMaybeRePromptWithDirective(
  buffer: string
): Promise<{ shouldRePrompt: boolean; next: string } | null> {
  const asyncInsight = await someAsyncLogicWithDirective(buffer);
  if (asyncInsight.shouldRePrompt) {
    console.log(
      "[Checkpoint] Re-prompting with instruction:",
      asyncInsight.next
    );
    return {
      shouldRePrompt: asyncInsight.shouldRePrompt,
      next: asyncInsight.next,
    };
  }
  return null; // keep going with current stream
}

async function inspectAndMaybeRePrompt(
  buffer: string
): Promise<{ shouldRePrompt: boolean; next: string } | null> {
  const asyncInsight = await someAsyncLogic(buffer);

  if (asyncInsight.shouldRePrompt) {
    console.log(
      "[Checkpoint] Re-prompting with instruction:",
      asyncInsight.next
    );
    return {
      shouldRePrompt: asyncInsight.shouldRePrompt,
      next: asyncInsight.next,
    };
  }
  return null; // keep going with current stream
}

const thoughts = ["I wonder how many apples I can fit in my mouth"];

const directives = ["talk about apples", "Get angry"];

let i = 0;
let j = 0;
async function someAsyncLogic(text: string) {
  // You could call another API, run a tool, check DB, etc.
  console.log("[Checkpoint] Async logic done");
  i++;
  i = i % thoughts.length;
  return {
    shouldRePrompt: text.includes("fridge magnet"), // example condition
    next: `${thoughts[i]}`,
  };
}

async function someAsyncLogicWithDirective(text: string) {
  console.log("[Checkpoint] Async directive done");
  j++;
  j = j % directives.length;
  return {
    shouldRePrompt: text.includes("cantaloupe"), // example condition
    next: `${directives[j]}`,
  };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function POST(req: Request) {
  const { prompt: initialPrompt } = await req.json();

  const thoughtsStream = streamThoughts(initialPrompt);
  const reader = thoughtsStream.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      const messageHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
        [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          { role: "user", content: initialPrompt },
        ];

      let newThoughtFromStreamAvailable = false; // Flag to signal new thoughts

      // Asynchronously process thoughts and add them to messageHistory
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log("[ThoughtsReader] Thoughts stream finished.");
              break;
            }
            const thoughtChunk = decoder.decode(value, { stream: true }).trim();
            if (thoughtChunk) {
              messageHistory.push({
                role: "developer",
                content: `<internal_thought>${thoughtChunk}</internal_thought>`,
              });
              console.log(
                `[ThoughtsReader] Added thought to message history: "${thoughtChunk.slice(
                  0,
                  100
                )}..."`
              );
              newThoughtFromStreamAvailable = true; // Signal new thought
            }
          }
        } catch (error) {
          console.error(
            "[ThoughtsReader] Error reading thoughts stream:",
            error
          );
        } finally {
          reader.releaseLock();
          console.log("[ThoughtsReader] Reader lock released.");
        }
      })(); // IIFE to start processing thoughts in parallel

      let shouldContinueStreaming = true;

      console.log(
        `[Stream] Initial user prompt: "${initialPrompt.slice(0, 100)}..."`
      );

      while (shouldContinueStreaming) {
        console.log(
          `[Stream] Calling OpenAI with ${
            messageHistory.length
          } messages. Last messages: "${messageHistory[
            messageHistory.length > 1
              ? messageHistory.length - 2
              : messageHistory.length - 1
          ].content
            ?.toString()
            .slice(-100)}..."`
        );
        const generator = streamOpenAI(messageHistory);
        let currentAssistantResponse = "";
        let potentialCheckpointBuffer = "";
        let sentenceCountForCheckpoint = 0; // Counter for sentences
        let rePromptedThisCycle = false;

        const MIN_LENGTH_CHECKPOINT = 70;
        const MAX_LENGTH_CHECKPOINT = 300;
        const TARGET_SENTENCES_FOR_CHECKPOINT = 1; // Inspect every 2 sentences

        for await (const token of generator) {
          if (typeof token.value === "string") {
            controller.enqueue(encoder.encode(token.value));
            currentAssistantResponse += token.value;
            potentialCheckpointBuffer += token.value;
          } else if (token.type === "tool_call") {
            // controller.enqueue(encoder.encode());
            currentAssistantResponse += JSON.stringify(token.value);
            potentialCheckpointBuffer += JSON.stringify(token.value);
          }

          let inspectNow = false;
          const trimmedBufferEnd = potentialCheckpointBuffer.trimEnd();
          const lastChar = trimmedBufferEnd.slice(-1);

          if (potentialCheckpointBuffer.length >= MIN_LENGTH_CHECKPOINT) {
            if ([".", "!", "?"].includes(lastChar)) {
              sentenceCountForCheckpoint++;
              console.log(
                `[Stream] Sentence end detected. Current sentence count: ${sentenceCountForCheckpoint}. Buffer length: ${potentialCheckpointBuffer.length}`
              );
              if (
                sentenceCountForCheckpoint >= TARGET_SENTENCES_FOR_CHECKPOINT
              ) {
                inspectNow = true;
                console.log(
                  `[Stream] Target sentence count (${TARGET_SENTENCES_FOR_CHECKPOINT}) reached.`
                );
              }
            }
          }

          if (
            !inspectNow &&
            potentialCheckpointBuffer.length >= MAX_LENGTH_CHECKPOINT
          ) {
            inspectNow = true;
            console.log(
              `[Stream] Max buffer length ${MAX_LENGTH_CHECKPOINT} reached, inspecting.`
            );
          }

          if (inspectNow) {
            if (newThoughtFromStreamAvailable) {
              console.log(
                "[Stream] New thought detected from parallel stream. Triggering re-prompt."
              );
              newThoughtFromStreamAvailable = false; // Reset the flag

              if (currentAssistantResponse.trim().length > 0) {
                controller.enqueue(encoder.encode(" "));
                messageHistory.push({
                  role: "assistant",
                  content: currentAssistantResponse,
                });
                messageHistory.push({
                  role: "developer",
                  content: currentAssistantResponse,
                });
                console.log(
                  `[Stream] Saved partial assistant response due to new external thought. Length: ${currentAssistantResponse.length}`
                );
              }
              // Reset buffers for the new generation cycle
              currentAssistantResponse = "";
              potentialCheckpointBuffer = "";
              sentenceCountForCheckpoint = 0;

              rePromptedThisCycle = true;
              break; // Break from this inner loop to force a new call to streamOpenAI
            }

            console.log(
              `[Stream] Checkpoint: Inspecting content. Current assistant response length: ${currentAssistantResponse.length}`
            );
            const newInternalThoughts = await inspectAndMaybeRePrompt(
              currentAssistantResponse
            );
            const newDirective = await inspectAndMaybeRePromptWithDirective(
              currentAssistantResponse
            );

            potentialCheckpointBuffer = "";
            sentenceCountForCheckpoint = 0; // Reset sentence counter after inspection

            if (newDirective && newDirective.shouldRePrompt) {
              console.log(`[Stream] Decision: Following directive.`);
              controller.enqueue(encoder.encode(" "));
              messageHistory.push({
                role: "assistant",
                content: currentAssistantResponse,
              });
              messageHistory.push({
                role: "developer",
                content: `<directive>${newDirective.next}</directive>`,
              });
              rePromptedThisCycle = true;
              break;
            }

            if (newInternalThoughts && newInternalThoughts.shouldRePrompt) {
              console.log(`[Stream] Decision: Re-prompting.`);
              controller.enqueue(encoder.encode(" "));
              messageHistory.push({
                role: "assistant",
                content: currentAssistantResponse,
              });
              messageHistory.push({
                role: "developer",
                content: `<internal_thought>${newInternalThoughts.next}</internal_thought>`,
              });
              console.log(
                `[Stream] New internal thought added to assistant history: "${newInternalThoughts.next.slice(
                  0,
                  100
                )}..."`
              );
              rePromptedThisCycle = true;
              break;
            }
          }
        }

        if (rePromptedThisCycle) {
          console.log(
            "[Stream] Broken from inner loop for re-prompt. Continuing outer loop for new generator."
          );
        } else {
          // Generator finished naturally, add its full response to history if it wasn't empty
          if (currentAssistantResponse.trim().length > 0) {
            messageHistory.push({
              role: "assistant",
              content: currentAssistantResponse,
            });
            console.log(
              `[Stream] Final assistant response for this cycle added to history. Length: ${currentAssistantResponse.length}`
            );
          }
          console.log("[Stream] Generator finished naturally. Ending stream.");
          shouldContinueStreaming = false;
        }
      }

      controller.close();
      console.log("history", messageHistory.map((m) => m.content).join("\n"));
      console.log("[Stream] Stream closed.");
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain" },
  });
}
