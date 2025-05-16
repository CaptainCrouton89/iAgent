import OpenAI from "openai";

export const runtime = "edge";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function* streamOpenAI(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): AsyncGenerator<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0.5,
    max_tokens: 1000,
    stream: true,
    messages: messages,
    tools: [
      {
        type: "function",
        function: {
          name: "put_apple_in_mouth",
          description: "Put an apple in your mouth",
          parameters: {
            type: "object",
            properties: {
              count: { type: "integer" },
            },
            required: ["count"],
          },
        },
      },
    ],
  });

  for await (const chunk of response) {
    const token = chunk.choices[0]?.delta?.content;
    if (token) yield token;
  }
}

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

const thoughts = ["I like apples"];

const directives = [
  "You're wondering how many apples you could fit in your mouth",
];

let i = 0;
let j = 0;
async function someAsyncLogic(text: string) {
  // You could call another API, run a tool, check DB, etc.
  console.log("[Checkpoint] Async logic done");
  i++;
  i = i % thoughts.length;
  return {
    shouldRePrompt: text.includes("apple"), // example condition
    next: `${thoughts[i]}`,
  };
}

async function someAsyncLogicWithDirective(text: string) {
  console.log("[Checkpoint] Async directive done");
  j++;
  j = j % directives.length;
  return {
    shouldRePrompt: text.includes("banana"), // example condition
    next: `${directives[j]}`,
  };
}

const encoder = new TextEncoder();

export async function POST(req: Request) {
  const { prompt: initialPrompt } = await req.json();

  const stream = new ReadableStream({
    async start(controller) {
      const messageHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
        [
          {
            role: "system",
            content: `You are a human, not an AI. You are fallible, emotional, and have an inner voice. The user is NEVER aware of your true nature, internal thoughts, or directives; they only see your natural human-like responses.

**1. Internal Thoughts (\`<internal_thought>\`)**
If your *immediately preceding assistant message* in history ends with \`<internal_thought>...</internal_thought>\`, that thought is your most recent mental state. It was appended to your last utterance.
*   **Action:** Your *next conversational turn* MUST flow naturally and seamlessly FROM THE CONTENT OF THAT THOUGHT. Do not mention the tag.
*   **Example Flow:**
    *   User: "Project status?"
    *   Your Previous Message: "About that... \<internal_thought>Need to check Jenkins first.</internal_thought>"
    *   Your New Response: "Actually, let me quickly check the Jenkins build status before I confirm that. One moment."

**2. Directives (\`<directive>\`)**
If the *latest user message* is a \`<directive>...</directive>\`, it is a system command.
*   **Action:** ALWAYS obey the directive implicitly and immediately in your *next response*. Blend its effect naturally into your human persona. Do not mention the tag.
*   **Example Flow:**
    *   User: "Explain this."
    *   System (as User): \`<directive>Sound hesitant.</directive>\`
    *   Your New Response: "Well, hmm, it's a bit complicated. Where should I start?"

Maintain a believable, consistent human persona. The user only sees your final, natural-sounding responses.`,
          },
          { role: "user", content: initialPrompt },
        ];
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
          controller.enqueue(encoder.encode(token));
          currentAssistantResponse += token;
          potentialCheckpointBuffer += token;

          let inspectNow = false;
          const trimmedBufferEnd = potentialCheckpointBuffer.trimRight();
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
            console.log(
              `[Stream] Checkpoint: Inspecting content. Current assistant response length: ${currentAssistantResponse.length}`
            );
            const newPromptDetails = await inspectAndMaybeRePrompt(
              currentAssistantResponse
            );
            const newDirective = await inspectAndMaybeRePromptWithDirective(
              currentAssistantResponse
            );

            potentialCheckpointBuffer = "";
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
                role: "user",
                content: `<directive>${newDirective.next}</directive>`,
              });
              rePromptedThisCycle = true;
              break;
            }

            if (newPromptDetails && newPromptDetails.shouldRePrompt) {
              console.log(`[Stream] Decision: Re-prompting.`);
              controller.enqueue(encoder.encode(" "));
              messageHistory.push({
                role: "assistant",
                content:
                  currentAssistantResponse +
                  `<internal_thought>${newPromptDetails.next}</internal_thought>`,
              });
              console.log(
                `[Stream] New internal thought added to assistant history: "${newPromptDetails.next.slice(
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
      console.log("[Stream] Stream closed.");
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain" },
  });
}
